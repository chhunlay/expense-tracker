"""
Ninja router - the whole JSON API in one place (the Ninja equivalent of
the old DRF api/views.py + api/urls.py combined, since Ninja routes are
declared right on the handler via decorators instead of a separate
urls.py). Every authenticated endpoint takes `auth=TokenAuth()`
(security.py) and reads the current user from `request.auth`; every
queryset is filtered to that user so one account can never read or
write another's rows, by id-guessing or otherwise - the same rule the
DRF viewsets enforced via get_queryset().
"""
from datetime import date, timedelta
from typing import List

from django.conf import settings as django_settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from ninja import File, Router, UploadedFile
from ninja.errors import HttpError

from .constants import DEFAULT_CATEGORIES
from .csv_io import export_transactions_csv, import_transactions_csv
from .dates import month_bounds, shift_month
from .models import Asset, AuthToken, Category, Transaction
from .quick_add import parse_quick_add
from .schemas import (
    AssetIn,
    AssetOut,
    AssetPatch,
    CategoryIn,
    CategoryOut,
    CategoryPatch,
    ImportResult,
    LoginIn,
    MonthlyTotal,
    ProfileOut,
    ProfilePatch,
    QuickAddIn,
    RegisterIn,
    ReportsOut,
    SummaryOut,
    TokenOut,
    TopCategory,
    TransactionIn,
    TransactionOut,
    TransactionPatch,
)
from .security import TokenAuth
from .services import get_daily_totals, get_monthly_totals
from .xlsx_io import export_transactions_xlsx, import_transactions_xlsx

router = Router()
auth = TokenAuth()


# ---------- Auth ----------
@router.post("/register", response={201: TokenOut}, auth=None)
def register(request, payload: RegisterIn):
    if len(payload.password) < 8:
        raise HttpError(400, "Password must be at least 8 characters.")
    if User.objects.filter(username=payload.username).exists():
        raise HttpError(400, "That username is already taken.")
    try:
        validate_password(payload.password)
    except DjangoValidationError as e:
        raise HttpError(400, " ".join(e.messages))

    user = User.objects.create_user(username=payload.username, password=payload.password)
    Category.objects.bulk_create(
        [Category(user=user, name=name, color=color) for name, color in DEFAULT_CATEGORIES]
    )
    token = AuthToken.objects.create(user=user)
    return 201, {"token": token.key}


@router.post("/token", response=TokenOut, auth=None)
def login(request, payload: LoginIn):
    user = authenticate(username=payload.username, password=payload.password)
    if user is None:
        raise HttpError(400, "Unable to log in with provided credentials.")
    token, _ = AuthToken.objects.get_or_create(user=user)
    return {"token": token.key}


# ---------- Categories ----------
@router.get("/categories", response=List[CategoryOut], auth=auth)
def list_categories(request):
    month_start = date.today().replace(day=1)
    categories = list(Category.objects.filter(user=request.auth))
    spent_by_category = {
        row["category_id"]: row["total"]
        for row in Transaction.objects.filter(
            user=request.auth, type=Transaction.EXPENSE, date__gte=month_start
        )
        .values("category_id")
        .annotate(total=Sum("amount"))
    }
    for c in categories:
        c.spent_this_month = float(spent_by_category.get(c.id) or 0)
    return categories


@router.post("/categories", response={201: CategoryOut}, auth=auth)
def create_category(request, payload: CategoryIn):
    category = Category.objects.create(user=request.auth, **payload.dict())
    return 201, category


@router.patch("/categories/{category_id}", response=CategoryOut, auth=auth)
def update_category(request, category_id: int, payload: CategoryPatch):
    category = get_object_or_404(Category, id=category_id, user=request.auth)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(category, field, value)
    category.save()
    return category


@router.delete("/categories/{category_id}", response={204: None}, auth=auth)
def delete_category(request, category_id: int):
    category = get_object_or_404(Category, id=category_id, user=request.auth)
    category.delete()
    return 204, None


# ---------- Transactions ----------
@router.get("/transactions", response=List[TransactionOut], auth=auth)
def list_transactions(request, month: str = None, category_id: int = None, limit: int = None):
    qs = Transaction.objects.filter(user=request.auth).select_related("category")
    if month:
        start, end = month_bounds(month)
        qs = qs.filter(date__gte=start, date__lt=end)
    if category_id:
        qs = qs.filter(category_id=category_id)
    if limit:
        qs = qs[:limit]
    return qs


def _validated_category(user, category_id):
    if category_id is None:
        return None
    category = get_object_or_404(Category, id=category_id, user=user)
    return category


@router.post("/transactions", response={201: TransactionOut}, auth=auth)
def create_transaction(request, payload: TransactionIn):
    category = _validated_category(request.auth, payload.category)
    txn = Transaction.objects.create(
        user=request.auth,
        type=payload.type,
        amount=payload.amount,
        category=category,
        date=payload.date,
        note=payload.note,
    )
    return 201, txn


@router.post("/quick-add", response={201: TransactionOut}, auth=auth)
def quick_add(request, payload: QuickAddIn):
    """Same one-line parser the old Dashboard's Quick add box used
    (quick_add.py, unchanged) - "Lunch 5.50 Food" or "+500 Salary"
    becomes a transaction dated today, filed under a matching
    category name if one appears in the text, "Other" otherwise."""
    categories = list(Category.objects.filter(user=request.auth))
    parsed = parse_quick_add(payload.text, categories) if payload.text.strip() else None
    if not parsed:
        raise HttpError(400, 'Couldn\'t find an amount in that - try something like "Lunch 5.50 Food"')

    category_id = parsed["category_id"]
    if category_id is None:
        other = Category.objects.filter(user=request.auth, name="Other").first()
        category_id = other.id if other else None

    txn = Transaction.objects.create(
        user=request.auth,
        date=date.today(),
        type=parsed["type"],
        amount=parsed["amount"],
        category_id=category_id,
        note=parsed["note"],
    )
    return 201, txn


@router.patch("/transactions/{transaction_id}", response=TransactionOut, auth=auth)
def update_transaction(request, transaction_id: int, payload: TransactionPatch):
    txn = get_object_or_404(Transaction, id=transaction_id, user=request.auth)
    data = payload.dict(exclude_unset=True)
    if "category" in data:
        data["category"] = _validated_category(request.auth, data["category"])
    for field, value in data.items():
        setattr(txn, field, value)
    txn.save()
    return txn


@router.delete("/transactions/{transaction_id}", response={204: None}, auth=auth)
def delete_transaction(request, transaction_id: int):
    txn = get_object_or_404(Transaction, id=transaction_id, user=request.auth)
    txn.delete()
    return 204, None


# ---------- Assets ----------
@router.get("/assets", response=List[AssetOut], auth=auth)
def list_assets(request):
    return Asset.objects.filter(user=request.auth)


@router.post("/assets", response={201: AssetOut}, auth=auth)
def create_asset(request, payload: AssetIn):
    asset = Asset.objects.create(user=request.auth, **payload.dict())
    return 201, asset


@router.patch("/assets/{asset_id}", response=AssetOut, auth=auth)
def update_asset(request, asset_id: int, payload: AssetPatch):
    asset = get_object_or_404(Asset, id=asset_id, user=request.auth)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(asset, field, value)
    asset.save()
    return asset


@router.delete("/assets/{asset_id}", response={204: None}, auth=auth)
def delete_asset(request, asset_id: int):
    asset = get_object_or_404(Asset, id=asset_id, user=request.auth)
    asset.delete()
    return 204, None


# ---------- Profile ----------
@router.get("/profile", response=ProfileOut, auth=auth)
def get_profile(request):
    return request.auth.profile


@router.patch("/profile", response=ProfileOut, auth=auth)
def update_profile(request, payload: ProfilePatch):
    profile = request.auth.profile
    data = payload.dict(exclude_unset=True)
    if "theme" in data and data["theme"] not in dict(profile.THEME_CHOICES):
        raise HttpError(400, "Not a valid theme.")
    if "language" in data and data["language"] not in dict(django_settings.LANGUAGES):
        raise HttpError(400, "Not a supported language.")
    for field, value in data.items():
        setattr(profile, field, value)
    profile.save()
    return profile


@router.post("/profile/picture", response=ProfileOut, auth=auth)
def upload_profile_picture(request, picture: UploadedFile = File(...)):
    profile = request.auth.profile
    profile.picture = picture
    profile.save()
    return profile


# ---------- Dashboard / Reports ----------
TREND_RANGE_OFFSETS = {
    # Offsets (months back from the current month) included in each
    # named range, oldest first - anchored to today regardless of the
    # `month` param, which only navigates the KPI cards/breakdown.
    "current_month": [0],
    "last_month": [1],
    "last_3_months": [2, 1, 0],
    "last_6_months": [5, 4, 3, 2, 1, 0],
}


def trend_months(trend_range: str) -> list[str]:
    y, m = date.today().year, date.today().month
    if trend_range == "current_year":
        offsets = list(range(m - 1, -1, -1))
    else:
        offsets = TREND_RANGE_OFFSETS.get(trend_range, TREND_RANGE_OFFSETS["last_3_months"])
    months = []
    for i in offsets:
        yy, mm = shift_month(y, m, -i)
        months.append("%04d-%02d" % (yy, mm))
    return months


@router.get("/summary", response=SummaryOut, auth=auth)
def summary(request, month: str = None, trend_range: str = "last_3_months"):
    """Everything the Dashboard renders for one month - the same
    numbers the old Django dashboard view computed (income/expense/
    net, net worth, the category breakdown, budget progress bars, and
    a 6-month trend for the mini chart), as one call."""
    month_str = month or date.today().strftime("%Y-%m")
    start, end = month_bounds(month_str)
    rows = list(
        Transaction.objects.filter(user=request.auth, date__gte=start, date__lt=end).select_related("category")
    )
    income = sum(float(t.amount) for t in rows if t.type == Transaction.INCOME)
    expense = sum(float(t.amount) for t in rows if t.type == Transaction.EXPENSE)
    net_worth = float(Asset.objects.filter(user=request.auth).aggregate(t=Sum("value"))["t"] or 0)

    breakdown_totals: dict[str, float] = {}
    breakdown_colors: dict[str, str] = {}
    for t in rows:
        if t.type != Transaction.EXPENSE:
            continue
        name = t.category.name if t.category else "Uncategorized"
        breakdown_totals[name] = breakdown_totals.get(name, 0.0) + float(t.amount)
        breakdown_colors[name] = t.category.color if t.category else "#94a3b8"
    breakdown = [
        {"name": name, "amount": amount, "color": breakdown_colors[name]}
        for name, amount in sorted(breakdown_totals.items(), key=lambda kv: -kv[1])
    ]

    budget_progress = []
    for c in Category.objects.filter(user=request.auth):
        if not c.budget_limit:
            continue
        spent = breakdown_totals.get(c.name, 0.0)
        limit = float(c.budget_limit)
        budget_progress.append({
            "name": c.name,
            "color": c.color,
            "spent": spent,
            "limit": limit,
            "pct": min(100, round(spent / limit * 100)) if limit else 0,
            "over": spent > limit,
        })

    if trend_range == "this_week":
        week_start = date.today() - timedelta(days=date.today().weekday())  # Monday
        days = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
        mini_trend = get_daily_totals(request.auth, days)
    else:
        mini_trend = get_monthly_totals(request.auth, trend_months(trend_range))

    return {
        "month": month_str,
        "income": income,
        "expense": expense,
        "net": income - expense,
        "net_worth": net_worth,
        "breakdown": breakdown,
        "budget_progress": budget_progress,
        "mini_trend": mini_trend,
    }


@router.get("/reports", response=ReportsOut, auth=auth)
def reports(request):
    months = []
    y, m = date.today().year, date.today().month
    for i in range(11, -1, -1):
        yy, mm = shift_month(y, m, -i)
        months.append("%04d-%02d" % (yy, mm))

    monthly_totals = [MonthlyTotal(**mt) for mt in get_monthly_totals(request.auth, months)]

    window_start = f"{months[0]}-01"
    top_categories = []
    for c in Category.objects.filter(user=request.auth):
        total = (
            Transaction.objects.filter(
                user=request.auth, category=c, type=Transaction.EXPENSE, date__gte=window_start
            ).aggregate(total=Sum("amount"))["total"]
        )
        total = float(total or 0)
        if total > 0:
            top_categories.append(TopCategory(name=c.name, color=c.color, total=total))
    top_categories.sort(key=lambda c: -c.total)

    return {"monthly_totals": monthly_totals, "top_categories": top_categories}


# ---------- Export / Import ----------
@router.get("/export/csv", auth=auth)
def export_csv(request):
    csv_text = export_transactions_csv(request.auth)
    response = HttpResponse(csv_text, content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="transactions.csv"'
    return response


@router.get("/export/xlsx", auth=auth)
def export_xlsx(request):
    xlsx_bytes = export_transactions_xlsx(request.auth)
    response = HttpResponse(
        xlsx_bytes, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = 'attachment; filename="transactions.xlsx"'
    return response


@router.post("/import", response=ImportResult, auth=auth)
def import_transactions(request, file: UploadedFile = File(...)):
    name = file.name.lower()
    file_bytes = file.read()
    if name.endswith(".csv"):
        imported, skipped, created = import_transactions_csv(request.auth, file_bytes)
    elif name.endswith(".xlsx"):
        imported, skipped, created = import_transactions_xlsx(request.auth, file_bytes)
    else:
        raise HttpError(400, "Unsupported file type - upload a .csv or .xlsx file")
    return {"imported": imported, "skipped": skipped, "created_categories": created}
