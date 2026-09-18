"""
Views - the Django equivalent of the Flask version's app.py routes, now
with real accounts: every data-bearing view is @login_required and
scoped to request.user (via the user FK added to Category/Transaction/
Asset), so each account only ever sees and touches its own data.
"""
from collections import defaultdict
from datetime import date

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.conf import settings as django_settings
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.translation import gettext as _

from .constants import DEFAULT_CATEGORIES
from .csv_io import export_transactions_csv, import_transactions_csv
from .dates import month_bounds, shift_month
from .models import Asset, Category, Profile, Transaction
from .quick_add import parse_quick_add
from .services import get_monthly_totals
from .xlsx_io import export_transactions_xlsx, import_transactions_xlsx


def register(request):
    if request.user.is_authenticated:
        return redirect("dashboard")

    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            # New accounts start with the same starter categories the
            # original single-user setup had - Profile itself is
            # created by the post_save signal in signals.py.
            Category.objects.bulk_create(
                [Category(user=user, name=name, color=color) for name, color in DEFAULT_CATEGORIES]
            )
            login(request, user)
            messages.success(request, _("Welcome! Your account is ready."))
            return redirect("dashboard")
    else:
        form = UserCreationForm()

    return render(request, "expenses/register.html", {"form": form})


@login_required
def settings_view(request):
    profile = request.user.profile

    if request.method == "POST":
        action = request.POST.get("action")
        if action == "picture":
            picture = request.FILES.get("picture")
            if picture:
                profile.picture = picture
                profile.save()
                messages.success(request, _("Profile picture updated"))
        elif action == "theme":
            theme = request.POST.get("theme")
            if theme in dict(Profile.THEME_CHOICES):
                profile.theme = theme
                profile.save()
                messages.success(request, _("Theme updated"))
        elif action == "language":
            language = request.POST.get("language")
            if language in dict(django_settings.LANGUAGES):
                profile.language = language
                profile.save()
                messages.success(request, _("Language updated"))
                # Django 6+ dropped session-based language storage in favor
                # of a cookie (LocaleMiddleware now only ever reads
                # settings.LANGUAGE_COOKIE_NAME from request.COOKIES), so
                # that's what LocaleMiddleware will pick up on every
                # subsequent request.
                response = redirect("settings")
                response.set_cookie(
                    django_settings.LANGUAGE_COOKIE_NAME, language,
                    max_age=365 * 24 * 60 * 60,
                )
                return response
        return redirect("settings")

    return render(request, "expenses/settings.html", {
        "profile": profile,
        "languages": django_settings.LANGUAGES,
        "theme_choices": Profile.THEME_CHOICES,
    })


@login_required
def dashboard(request):
    categories = Category.objects.filter(user=request.user)

    month_str = request.GET.get("month") or date.today().strftime("%Y-%m")
    start, end = month_bounds(month_str)
    year, mo = (int(p) for p in month_str.split("-"))
    prev_month = "%04d-%02d" % shift_month(year, mo, -1)
    next_month = "%04d-%02d" % shift_month(year, mo, 1)

    rows = (
        Transaction.objects.filter(user=request.user)
        .select_related("category")
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
    mini_trend = get_monthly_totals(request.user, mini_months)

    net_worth = Asset.objects.filter(user=request.user).aggregate(total=Sum("value"))["total"] or 0

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
            "net_worth": float(net_worth),
        },
    )


@login_required
def quick_add(request):
    text = (request.POST.get("text") or "").strip()
    categories = list(Category.objects.filter(user=request.user))
    parsed = parse_quick_add(text, categories) if text else None

    if not parsed:
        messages.error(request, _('Couldn\'t find an amount in that - try something like "Lunch 5.50 Food"'))
        return redirect(f"{reverse('dashboard')}?month={request.POST.get('month', '')}")

    category_id = parsed["category_id"]
    if category_id is None:
        other = Category.objects.filter(user=request.user, name="Other").first()
        category_id = other.id if other else None

    Transaction.objects.create(
        user=request.user,
        date=date.today(),
        type=parsed["type"],
        amount=parsed["amount"],
        category_id=category_id,
        note=parsed["note"],
    )
    messages.success(request, _("Added %(type)s of %(amount).2f") % {"type": parsed["type"], "amount": parsed["amount"]})
    return redirect(f"{reverse('dashboard')}?month={request.POST.get('month', '')}")


@login_required
def add_transaction(request):
    """POST-only - reached from the Add-transaction popup on the
    Transactions page, same as the Flask version's /add route."""
    if request.method != "POST":
        return HttpResponse(status=405)

    Transaction.objects.create(
        user=request.user,
        date=request.POST["date"],
        type=request.POST["type"],
        amount=request.POST["amount"],
        category_id=request.POST.get("category_id") or None,
        note=request.POST.get("note") or None,
    )
    messages.success(request, _("Transaction added"))
    return redirect("transactions")


@login_required
def edit_transaction(request, pk):
    txn = get_object_or_404(Transaction, pk=pk, user=request.user)
    if request.method == "POST":
        txn.date = request.POST["date"]
        txn.type = request.POST["type"]
        txn.amount = request.POST["amount"]
        txn.category_id = request.POST.get("category_id") or None
        txn.note = request.POST.get("note") or None
        txn.save()
        messages.success(request, _("Transaction updated"))
        return redirect("transactions")

    categories = Category.objects.filter(user=request.user)
    return render(request, "expenses/edit.html", {"txn": txn, "categories": categories})


@login_required
def delete_transaction(request, pk):
    Transaction.objects.filter(pk=pk, user=request.user).delete()
    messages.success(request, _("Transaction deleted"))
    return redirect(request.META.get("HTTP_REFERER") or reverse("dashboard"))


@login_required
def transactions_list(request):
    categories = Category.objects.filter(user=request.user)
    month = request.GET.get("month", "")
    category_id = request.GET.get("category_id", "")

    rows = Transaction.objects.filter(user=request.user).select_related("category")
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


@login_required
def export_csv(request):
    csv_text = export_transactions_csv(request.user)
    filename = f"expenses-export-{date.today().isoformat()}.csv"
    response = HttpResponse(csv_text, content_type="text/csv")
    response["Content-Disposition"] = f"attachment; filename={filename}"
    return response


@login_required
def export_xlsx(request):
    xlsx_bytes = export_transactions_xlsx(request.user)
    filename = f"expenses-export-{date.today().isoformat()}.xlsx"
    response = HttpResponse(
        xlsx_bytes, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = f"attachment; filename={filename}"
    return response


_IMPORTERS = {".csv": import_transactions_csv, ".xlsx": import_transactions_xlsx}


@login_required
def import_transactions(request):
    if request.method == "POST":
        file = request.FILES.get("file")
        if not file:
            messages.error(request, _("Choose a file first"))
            return redirect("import_transactions")

        ext = "." + file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
        importer = _IMPORTERS.get(ext)
        if importer is None:
            messages.error(request, _("Unsupported file type - upload a .csv or .xlsx file"))
            return redirect("import_transactions")

        imported, skipped, created = importer(request.user, file.read())

        parts = [_("Imported %(count)d transaction(s)") % {"count": imported}]
        if created:
            parts.append(_("created %(count)d new categor(y/ies)") % {"count": created})
        if skipped:
            parts.append(_("skipped %(count)d invalid row(s)") % {"count": skipped})
        (messages.success if imported else messages.error)(request, ", ".join(parts))
        return redirect("transactions")

    return render(request, "expenses/import.html")


@login_required
def categories_view(request):
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add":
            name = (request.POST.get("name") or "").strip()
            if name:
                if Category.objects.filter(user=request.user, name__iexact=name).exists():
                    messages.error(request, _("A category with that name already exists"))
                else:
                    Category.objects.create(
                        user=request.user,
                        name=name,
                        color=request.POST.get("color") or "#6366f1",
                        budget_limit=request.POST.get("budget_limit") or None,
                    )
                    messages.success(request, _("Category added"))
        elif action == "update":
            cat = get_object_or_404(Category, pk=request.POST["id"], user=request.user)
            new_name = request.POST["name"].strip()
            if Category.objects.filter(user=request.user, name__iexact=new_name).exclude(pk=cat.pk).exists():
                messages.error(request, _("A category with that name already exists"))
            else:
                cat.name = new_name
                cat.color = request.POST.get("color") or "#6366f1"
                cat.budget_limit = request.POST.get("budget_limit") or None
                cat.save()
                messages.success(request, _("Category updated"))
        elif action == "delete":
            # Transactions in this category fall back to "Uncategorized"
            # (category=NULL, via on_delete=SET_NULL on the model) rather
            # than being deleted - a category rename/cleanup should never
            # destroy spending history.
            Category.objects.filter(pk=request.POST["id"], user=request.user).delete()
            messages.success(request, _("Category deleted"))
        return redirect("categories")

    month_start = date.today().replace(day=1)
    categories = Category.objects.filter(user=request.user)
    for c in categories:
        spent = (
            Transaction.objects.filter(user=request.user, category=c, type=Transaction.EXPENSE, date__gte=month_start)
            .aggregate(total=Sum("amount"))["total"]
        )
        c.spent_this_month = float(spent or 0)

    return render(request, "expenses/categories.html", {"categories": categories})


@login_required
def assets_view(request):
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add":
            name = (request.POST.get("name") or "").strip()
            if name:
                Asset.objects.create(
                    user=request.user,
                    name=name,
                    asset_type=request.POST.get("asset_type") or Asset.OTHER,
                    value=request.POST.get("value") or 0,
                    note=request.POST.get("note") or None,
                )
                messages.success(request, _("Asset added"))
        elif action == "update":
            asset = get_object_or_404(Asset, pk=request.POST["id"], user=request.user)
            asset.name = (request.POST.get("name") or asset.name).strip()
            asset.asset_type = request.POST.get("asset_type") or asset.asset_type
            asset.value = request.POST.get("value") or 0
            asset.note = request.POST.get("note") or None
            asset.save()
            messages.success(request, _("Asset updated"))
        elif action == "delete":
            Asset.objects.filter(pk=request.POST["id"], user=request.user).delete()
            messages.success(request, _("Asset deleted"))
        return redirect("assets")

    assets = Asset.objects.filter(user=request.user)
    total_value = assets.aggregate(total=Sum("value"))["total"] or 0

    return render(
        request,
        "expenses/assets.html",
        {"assets": assets, "total_value": float(total_value), "asset_types": Asset.TYPE_CHOICES},
    )


@login_required
def reports(request):
    months = []
    y, m = date.today().year, date.today().month
    for i in range(11, -1, -1):
        yy, mm = shift_month(y, m, -i)
        months.append("%04d-%02d" % (yy, mm))

    monthly_totals = get_monthly_totals(request.user, months)

    window_start = f"{months[0]}-01"
    top_categories = []
    for c in Category.objects.filter(user=request.user):
        total = (
            Transaction.objects.filter(user=request.user, category=c, type=Transaction.EXPENSE, date__gte=window_start)
            .aggregate(total=Sum("amount"))["total"]
        )
        total = float(total or 0)
        if total > 0:
            top_categories.append({"name": c.name, "color": c.color, "total": total})
    top_categories.sort(key=lambda c: -c["total"])

    return render(
        request, "expenses/reports.html", {"monthly_totals": monthly_totals, "top_categories": top_categories}
    )
