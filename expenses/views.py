"""
Views - the Django equivalent of the Flask version's app.py routes.
Each one follows the same shape app.py's README comment described:
fetch what the page needs (via the ORM here instead of get_db()), then
render_template / render.
"""
from collections import defaultdict
from datetime import date, datetime

from django.contrib import messages
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from .csv_io import export_transactions_csv, import_transactions_csv
from .dates import month_bounds, shift_month
from .models import Category, Transaction
from .quick_add import parse_quick_add
from .services import get_monthly_totals
from .xlsx_io import export_transactions_xlsx, import_transactions_xlsx


def dashboard(request):
    categories = Category.objects.all()

    month_str = request.GET.get("month") or date.today().strftime("%Y-%m")
    start, end = month_bounds(month_str)
    year, mo = (int(p) for p in month_str.split("-"))
    prev_month = "%04d-%02d" % shift_month(year, mo, -1)
    next_month = "%04d-%02d" % shift_month(year, mo, 1)

    rows = (
        Transaction.objects.select_related("category")
        .filter(date__gte=start, date__lt=end)
        .order_by("-date", "-id")
    )

    total_expense = sum(float(t.amount) for t in rows if t.type == Transaction.EXPENSE)
    total_income = sum(float(t.amount) for t in rows if t.type == Transaction.INCOME)

    breakdown_totals = defaultdict(float)
    breakdown_colors = {}
    for t in rows:
        if t.type != Transaction.EXPENSE:
            continue
        name = t.category.name if t.category else "Uncategorized"
        breakdown_totals[name] += float(t.amount)
        breakdown_colors[name] = t.category.color if t.category else "#94a3b8"

    breakdown = [
        {"name": name, "amount": amount, "color": breakdown_colors[name]}
        for name, amount in sorted(breakdown_totals.items(), key=lambda kv: -kv[1])
    ]

    budget_progress = []
    for c in categories:
        if not c.budget_limit:
            continue
        spent = breakdown_totals.get(c.name, 0.0)
        limit = float(c.budget_limit)
        budget_progress.append(
            {
                "name": c.name,
                "color": c.color,
                "spent": spent,
                "limit": limit,
                "pct": min(100, round(spent / limit * 100)),
                "over": spent > limit,
            }
        )

    mini_months = []
    y, m = date.today().year, date.today().month
    for i in range(5, -1, -1):
        yy, mm = shift_month(y, m, -i)
        mini_months.append("%04d-%02d" % (yy, mm))
    mini_trend = get_monthly_totals(mini_months)

    return render(
        request,
        "expenses/dashboard.html",
        {
            "month_str": month_str,
            "prev_month": prev_month,
            "next_month": next_month,
            "is_current_month": month_str == date.today().strftime("%Y-%m"),
            "total_expense": total_expense,
            "total_income": total_income,
            "net": total_income - total_expense,
            "breakdown": breakdown,
            "budget_progress": budget_progress,
            "recent": rows[:8],
            "categories": categories,
            "today": date.today().isoformat(),
            "mini_trend": mini_trend,
        },
    )


def quick_add(request):
    text = (request.POST.get("text") or "").strip()
    categories = list(Category.objects.all())
    parsed = parse_quick_add(text, categories) if text else None

    if not parsed:
        messages.error(request, 'Couldn\'t find an amount in that - try something like "Lunch 5.50 Food"')
        return redirect(f"{reverse('dashboard')}?month={request.POST.get('month', '')}")

    category_id = parsed["category_id"]
    if category_id is None:
        other = Category.objects.filter(name="Other").first()
        category_id = other.id if other else None

    Transaction.objects.create(
        date=date.today(),
        type=parsed["type"],
        amount=parsed["amount"],
        category_id=category_id,
        note=parsed["note"],
    )
    messages.success(request, f"Added {parsed['type']} of {parsed['amount']:.2f}")
    return redirect(f"{reverse('dashboard')}?month={request.POST.get('month', '')}")


def add_transaction(request):
    """POST-only - reached from the Add-transaction popup on the
    Transactions page, same as the Flask version's /add route."""
    if request.method != "POST":
        return HttpResponse(status=405)

    Transaction.objects.create(
        date=request.POST["date"],
        type=request.POST["type"],
        amount=request.POST["amount"],
        category_id=request.POST.get("category_id") or None,
        note=request.POST.get("note") or None,
    )
    messages.success(request, "Transaction added")
    return redirect("transactions")


def edit_transaction(request, pk):
    txn = get_object_or_404(Transaction, pk=pk)
    if request.method == "POST":
        txn.date = request.POST["date"]
        txn.type = request.POST["type"]
        txn.amount = request.POST["amount"]
        txn.category_id = request.POST.get("category_id") or None
        txn.note = request.POST.get("note") or None
        txn.save()
        messages.success(request, "Transaction updated")
        return redirect("transactions")

    categories = Category.objects.all()
    return render(request, "expenses/edit.html", {"txn": txn, "categories": categories})


def delete_transaction(request, pk):
    Transaction.objects.filter(pk=pk).delete()
    messages.success(request, "Transaction deleted")
    return redirect(request.META.get("HTTP_REFERER") or reverse("dashboard"))


def transactions_list(request):
    categories = Category.objects.all()
    month = request.GET.get("month", "")
    category_id = request.GET.get("category_id", "")

    rows = Transaction.objects.select_related("category").all()
    if month:
        rows = rows.filter(date__year=int(month[:4]), date__month=int(month[5:7]))
    if category_id:
        rows = rows.filter(category_id=category_id)
    rows = rows.order_by("-date", "-id")

    return render(
        request,
        "expenses/transactions.html",
        {
            "rows": rows,
            "categories": categories,
            "month": month,
            "category_id": category_id,
            "today": date.today().isoformat(),
        },
    )


def export_csv(request):
    csv_text = export_transactions_csv()
    filename = f"expenses-export-{date.today().isoformat()}.csv"
    response = HttpResponse(csv_text, content_type="text/csv")
    response["Content-Disposition"] = f"attachment; filename={filename}"
    return response


def export_xlsx(request):
    xlsx_bytes = export_transactions_xlsx()
    filename = f"expenses-export-{date.today().isoformat()}.xlsx"
    response = HttpResponse(
        xlsx_bytes, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = f"attachment; filename={filename}"
    return response


_IMPORTERS = {".csv": import_transactions_csv, ".xlsx": import_transactions_xlsx}


def import_transactions(request):
    if request.method == "POST":
        file = request.FILES.get("file")
        if not file:
            messages.error(request, "Choose a file first")
            return redirect("import_transactions")

        ext = "." + file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
        importer = _IMPORTERS.get(ext)
        if importer is None:
            messages.error(request, "Unsupported file type - upload a .csv or .xlsx file")
            return redirect("import_transactions")

        imported, skipped, created = importer(file.read())

        parts = [f"Imported {imported} transaction{'s' if imported != 1 else ''}"]
        if created:
            parts.append(f"created {created} new categor{'y' if created == 1 else 'ies'}")
        if skipped:
            parts.append(f"skipped {skipped} invalid row{'s' if skipped != 1 else ''}")
        (messages.success if imported else messages.error)(request, ", ".join(parts))
        return redirect("transactions")

    return render(request, "expenses/import.html")


def categories_view(request):
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add":
            name = (request.POST.get("name") or "").strip()
            if name:
                if Category.objects.filter(name__iexact=name).exists():
                    messages.error(request, "A category with that name already exists")
                else:
                    Category.objects.create(
                        name=name,
                        color=request.POST.get("color") or "#6366f1",
                        budget_limit=request.POST.get("budget_limit") or None,
                    )
                    messages.success(request, "Category added")
        elif action == "update":
            cat = get_object_or_404(Category, pk=request.POST["id"])
            new_name = request.POST["name"].strip()
            if Category.objects.filter(name__iexact=new_name).exclude(pk=cat.pk).exists():
                messages.error(request, "A category with that name already exists")
            else:
                cat.name = new_name
                cat.color = request.POST.get("color") or "#6366f1"
                cat.budget_limit = request.POST.get("budget_limit") or None
                cat.save()
                messages.success(request, "Category updated")
        elif action == "delete":
            # Transactions in this category fall back to "Uncategorized"
            # (category=NULL, via on_delete=SET_NULL on the model) rather
            # than being deleted - a category rename/cleanup should never
            # destroy spending history.
            Category.objects.filter(pk=request.POST["id"]).delete()
            messages.success(request, "Category deleted")
        return redirect("categories")

    month_start = date.today().replace(day=1)
    categories = Category.objects.all()
    for c in categories:
        spent = (
            Transaction.objects.filter(category=c, type=Transaction.EXPENSE, date__gte=month_start)
            .aggregate(total=Sum("amount"))["total"]
        )
        c.spent_this_month = float(spent or 0)

    return render(request, "expenses/categories.html", {"categories": categories})


def reports(request):
    months = []
    y, m = date.today().year, date.today().month
    for i in range(11, -1, -1):
        yy, mm = shift_month(y, m, -i)
        months.append("%04d-%02d" % (yy, mm))

    monthly_totals = get_monthly_totals(months)

    window_start = f"{months[0]}-01"
    top_categories = []
    for c in Category.objects.all():
        total = (
            Transaction.objects.filter(category=c, type=Transaction.EXPENSE, date__gte=window_start)
            .aggregate(total=Sum("amount"))["total"]
        )
        total = float(total or 0)
        if total > 0:
            top_categories.append({"name": c.name, "color": c.color, "total": total})
    top_categories.sort(key=lambda c: -c["total"])

    return render(
        request, "expenses/reports.html", {"monthly_totals": monthly_totals, "top_categories": top_categories}
    )
