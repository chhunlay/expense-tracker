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
from .models import Asset, AuthToken, Category, SavedSearch, Transaction
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
    SavedSearchIn,
    SavedSearchOut,
    SavedSearchPatch,
    SummaryOut,
    TokenOut,
    TopCategory,
    TransactionIn,
    TransactionOut,
    TransactionPatch,
)
from .security import TokenAuth
from .services import get_daily_totals, get_monthly_totals, get_weekly_totals
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
        [Category(user=user, name=name, color=color, icon=icon) for name, color, icon in DEFAULT_CATEGORIES]
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
def list_transactions(
    request,
    month: str = None,
    date_from: str = None,
    date_to: str = None,
    category_id: int = None,
    category_ids: str = None,
    asset_id: int = None,
    limit: int = None,
):
    qs = Transaction.objects.filter(user=request.auth).select_related("category", "asset")
    if month:
        start, end = month_bounds(month)
        qs = qs.filter(date__gte=start, date__lt=end)
    elif date_from or date_to:
        # Used by the Transactions page's Date filter for a quarter (a
        # span month_bounds() can't express with a single YYYY-MM) -
        # inclusive on both ends, unlike month's half-open range above.
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
    if category_ids:
        # Multi-select filter from the Transactions page; category_id
        # (singular) stays for any other caller that only ever needs one.
        ids = [int(i) for i in category_ids.split(",") if i]
        qs = qs.filter(category_id__in=ids)
    elif category_id:
        qs = qs.filter(category_id=category_id)
    if asset_id:
        # Used by the Assets page to list an asset's own payments.
        qs = qs.filter(asset_id=asset_id)
    if limit:
        qs = qs[:limit]
    return qs


def _validated_category(user, category_id):
    if category_id is None:
        return None
    category = get_object_or_404(Category, id=category_id, user=user)
    return category


def _validated_asset(user, asset_id):
    if asset_id is None:
        return None
    asset = get_object_or_404(Asset, id=asset_id, user=user)
    return asset


@router.post("/transactions", response={201: TransactionOut}, auth=auth)
def create_transaction(request, payload: TransactionIn):
    category = _validated_category(request.auth, payload.category)
    asset = _validated_asset(request.auth, payload.asset)
    txn = Transaction.objects.create(
        user=request.auth,
        type=payload.type,
        amount=payload.amount,
        category=category,
        asset=asset,
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
    if "asset" in data:
        data["asset"] = _validated_asset(request.auth, data["asset"])
    for field, value in data.items():
        setattr(txn, field, value)
    txn.save()
    return txn


@router.delete("/transactions/{transaction_id}", response={204: None}, auth=auth)
def delete_transaction(request, transaction_id: int):
    txn = get_object_or_404(Transaction, id=transaction_id, user=request.auth)
    txn.delete()
    return 204, None


# ---------- Saved searches ----------
@router.get("/saved-searches", response=List[SavedSearchOut], auth=auth)
def list_saved_searches(request, page: str):
    return SavedSearch.objects.filter(user=request.auth, page=page)


@router.post("/saved-searches", response={201: SavedSearchOut}, auth=auth)
def create_saved_search(request, payload: SavedSearchIn):
    data = payload.dict()
    if data["is_default"]:
        # Only one default per page, per user - clear any existing one
        # rather than ending up with two searches both claiming it.
        SavedSearch.objects.filter(user=request.auth, page=data["page"], is_default=True).update(is_default=False)
    saved = SavedSearch.objects.create(user=request.auth, **data)
    return 201, saved


@router.patch("/saved-searches/{search_id}", response=SavedSearchOut, auth=auth)
def update_saved_search(request, search_id: int, payload: SavedSearchPatch):
    saved = get_object_or_404(SavedSearch, id=search_id, user=request.auth)
    if payload.is_default:
        SavedSearch.objects.filter(user=request.auth, page=saved.page, is_default=True).update(is_default=False)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(saved, field, value)
    saved.save()
    return saved


@router.delete("/saved-searches/{search_id}", response={204: None}, auth=auth)
def delete_saved_search(request, search_id: int):
    saved = get_object_or_404(SavedSearch, id=search_id, user=request.auth)
    saved.delete()
    return 204, None


# ---------- Assets ----------
@router.get("/assets", response=List[AssetOut], auth=auth)
def list_assets(request):
    assets = list(Asset.objects.filter(user=request.auth))
    paid_by_asset = {
        row["asset_id"]: float(row["total"])
        for row in Transaction.objects.filter(
            user=request.auth, asset__isnull=False, type=Transaction.EXPENSE
        )
        .values("asset_id")
        .annotate(total=Sum("amount"))
    }
    for a in assets:
        a.paid_amount = paid_by_asset.get(a.id, 0.0)
    return assets


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
    if "email" in data:
        request.auth.email = data.pop("email")
        request.auth.save(update_fields=["email"])
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


@router.post("/profile/favicon", response=ProfileOut, auth=auth)
def upload_favicon(request, favicon: UploadedFile = File(...)):
    profile = request.auth.profile
    profile.favicon = favicon
    profile.save()
    return profile


# ---------- Dashboard / Reports ----------
TREND_RANGE_OFFSETS = {
    # Offsets (months back from the anchor month) included in each
    # named range, oldest first.
    # "this_month" isn't here - it gets weekly-bucketed points instead,
    # same idea as "this_week"'s daily points (see summary() below).
    "last_month": [1],
    "last_3_months": [2, 1, 0],
    "last_6_months": [5, 4, 3, 2, 1, 0],
}


def month_anchor(month_str: str) -> date:
    """The reference point every trend_range is computed relative to -
    real today when `month_str` is the current calendar month, or that
    month's last day otherwise. Every trend/breakdown calculation used
    to anchor to date.today() unconditionally, which meant the Trend
    chart and "Where it went" never changed when Prev/Next navigated
    to a different month - only the KPI cards did. Anchoring to the
    navigated month instead makes Prev/Next actually affect them too,
    while still behaving exactly as before when `month_str` is the
    current month (the common case)."""
    y, m = (int(p) for p in month_str.split("-"))
    today = date.today()
    if (y, m) == (today.year, today.month):
        return today
    _, next_month_start = month_bounds(month_str)
    return date(*(int(p) for p in next_month_start.split("-"))) - timedelta(days=1)


def trend_months(trend_range: str, anchor: date) -> list[str]:
    y, m = anchor.year, anchor.month
    if trend_range == "current_year":
        offsets = list(range(m - 1, -1, -1))
    else:
        offsets = TREND_RANGE_OFFSETS.get(trend_range, TREND_RANGE_OFFSETS["last_3_months"])
    months = []
    for i in offsets:
        yy, mm = shift_month(y, m, -i)
        months.append("%04d-%02d" % (yy, mm))
    return months


def trend_date_bounds(trend_range: str, anchor: date) -> tuple[date, date]:
    """The same window each trend_range's chart points span (inclusive
    on both ends) - used to scope the "Where it went" breakdown to
    match whatever the Trend chart is currently showing, and to build
    the human-readable label under the Trend heading. Kept separate
    from trend_months()/the day/week bucket logic in summary() below,
    which need the window broken into points rather than one range."""
    if trend_range == "this_week":
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=6)
    if trend_range == "this_month":
        start = date(anchor.year, anchor.month, 1)
        _, next_month_start = month_bounds(anchor.strftime("%Y-%m"))
        end = date(*(int(p) for p in next_month_start.split("-"))) - timedelta(days=1)
        return start, end
    if trend_range == "last_month":
        y, m = shift_month(anchor.year, anchor.month, -1)
        end = date(anchor.year, anchor.month, 1) - timedelta(days=1)
        return date(y, m, 1), end
    if trend_range == "current_year":
        return date(anchor.year, 1, 1), anchor
    months_back = {"last_6_months": 5}.get(trend_range, 2)  # last_3_months + fallback
    y, m = shift_month(anchor.year, anchor.month, -months_back)
    return date(y, m, 1), anchor


def format_trend_label(trend_range: str, start: date, end: date) -> str:
    if trend_range == "this_week":
        return f"{start.strftime('%b')} {start.day} – {end.strftime('%b')} {end.day}, {end.year}"
    if trend_range in ("this_month", "last_month"):
        return start.strftime("%B %Y")
    if start.year == end.year:
        return f"{start.strftime('%b')} – {end.strftime('%b %Y')}"
    return f"{start.strftime('%b %Y')} – {end.strftime('%b %Y')}"


@router.get("/summary", response=SummaryOut, auth=auth)
def summary(request, month: str = None, trend_range: str = "this_month"):
    """Everything the Dashboard renders for one month - the same
    numbers the old Django dashboard view computed (income/expense/
    net, net worth, the category breakdown, budget progress bars, and
    a 6-month trend for the mini chart), as one call."""
    month_str = month or date.today().strftime("%Y-%m")
    anchor = month_anchor(month_str)
    start, end = month_bounds(month_str)
    rows = list(
        Transaction.objects.filter(user=request.auth, date__gte=start, date__lt=end).select_related("category")
    )
    income = sum(float(t.amount) for t in rows if t.type == Transaction.INCOME)
    expense = sum(float(t.amount) for t in rows if t.type == Transaction.EXPENSE)
    # Summed in Python via computed_value(), not a DB Sum("value") -
    # a depreciating asset's current worth isn't the raw stored `value`
    # column (see Asset.computed_value()).
    net_worth = sum(float(a.computed_value()) for a in Asset.objects.filter(user=request.auth))

    # Budgets stay scoped to the navigated calendar month (a monthly
    # budget_limit compared against anything else wouldn't mean much),
    # so this dict is built from `rows` and used only for that.
    month_expense_totals: dict[str, float] = {}
    for t in rows:
        if t.type != Transaction.EXPENSE:
            continue
        name = t.category.name if t.category else "Uncategorized"
        month_expense_totals[name] = month_expense_totals.get(name, 0.0) + float(t.amount)

    budget_progress = []
    for c in Category.objects.filter(user=request.auth):
        if not c.budget_limit:
            continue
        spent = month_expense_totals.get(c.name, 0.0)
        limit = float(c.budget_limit)
        budget_progress.append({
            "name": c.name,
            "color": c.color,
            "icon": c.icon,
            "spent": spent,
            "limit": limit,
            "pct": min(100, round(spent / limit * 100)) if limit else 0,
            "over": spent > limit,
        })

    # "Where it went" instead follows the Trend chart's own filter
    # (trend_range), not the month nav - so it's built from its own
    # query over trend_date_bounds() rather than reusing `rows`.
    trend_start, trend_end = trend_date_bounds(trend_range, anchor)
    breakdown_rows = Transaction.objects.filter(
        user=request.auth, type=Transaction.EXPENSE, date__gte=trend_start, date__lte=trend_end
    ).select_related("category")
    breakdown_totals: dict[str, float] = {}
    breakdown_colors: dict[str, str] = {}
    breakdown_icons: dict[str, str] = {}
    for t in breakdown_rows:
        name = t.category.name if t.category else "Uncategorized"
        breakdown_totals[name] = breakdown_totals.get(name, 0.0) + float(t.amount)
        breakdown_colors[name] = t.category.color if t.category else "#94a3b8"
        breakdown_icons[name] = t.category.icon if t.category else "tag"
    breakdown = [
        {"name": name, "amount": amount, "color": breakdown_colors[name], "icon": breakdown_icons[name]}
        for name, amount in sorted(breakdown_totals.items(), key=lambda kv: -kv[1])
    ]
    trend_label = format_trend_label(trend_range, trend_start, trend_end)

    if trend_range == "this_week":
        week_start = anchor - timedelta(days=anchor.weekday())  # Monday
        days = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
        mini_trend = get_daily_totals(request.auth, days)
    elif trend_range == "this_month":
        # Runs through the month's last day (like "this_week" running
        # through Sunday), not just up to the anchor - future weeks
        # report zero until transactions land in them.
        _, next_month_start = month_bounds(anchor.strftime("%Y-%m"))
        month_end = date(*(int(p) for p in next_month_start.split("-"))) - timedelta(days=1)
        buckets = []
        cursor = date(anchor.year, anchor.month, 1)
        week_num = 1
        while cursor <= month_end:
            bucket_end = min(cursor + timedelta(days=6), month_end)
            buckets.append((f"Week {week_num}", cursor.isoformat(), bucket_end.isoformat()))
            cursor = bucket_end + timedelta(days=1)
            week_num += 1
        mini_trend = get_weekly_totals(request.auth, buckets)
    else:
        mini_trend = get_monthly_totals(request.auth, trend_months(trend_range, anchor))

    return {
        "month": month_str,
        "income": income,
        "expense": expense,
        "net": income - expense,
        "net_worth": net_worth,
        "breakdown": breakdown,
        "budget_progress": budget_progress,
        "mini_trend": mini_trend,
        "trend_label": trend_label,
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
