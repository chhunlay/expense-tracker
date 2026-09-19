"""
Pydantic (via django-ninja's Schema) request/response shapes - the
Ninja equivalent of the old DRF serializers.py. Decimal fields
(amount/value/budget_limit) are typed `str` on the way out so the
Next.js frontend (which already treats these as strings, e.g.
`parseFloat(a.value)`) sees no change in shape from the DRF version -
Pydantic would otherwise serialize Decimal as a JSON number.

`date` is imported as `DateType` (not the plain `date` its own type
usually goes by) specifically so it can't collide with a field that's
also named `date` (every transaction schema below has one). A field
named the same as its own type, when that field also carries a
default value (e.g. `date: Optional[date] = None`), makes Pydantic
resolve the annotation against the class's own namespace - which by
then holds `date = None` - instead of the imported class, so the
field's real type silently becomes `None`. Caught via a PATCH
/api/transactions/{id} call failing with a 422
"Input should be None" on the date field even though a real date was
sent - only TransactionPatch's `date` had a default value, which is
why TransactionIn/TransactionOut's identically-named required `date`
fields weren't affected.
"""
from datetime import date as DateType
from datetime import datetime
from decimal import Decimal
from typing import Optional

from ninja import Schema


# ---------- Categories ----------
class CategoryOut(Schema):
    id: int
    name: str
    color: str
    budget_limit: Optional[str] = None
    # Not a model field - the list endpoint annotates each Category
    # instance with this before serializing (same pattern the old
    # Django categories_view used), so it's only ever populated by
    # GET /categories, not by the create/update responses.
    spent_this_month: float = 0.0

    @staticmethod
    def resolve_budget_limit(obj) -> Optional[str]:
        return str(obj.budget_limit) if obj.budget_limit is not None else None

    @staticmethod
    def resolve_spent_this_month(obj) -> float:
        return getattr(obj, "spent_this_month", 0.0)


class CategoryIn(Schema):
    name: str
    color: str = "#6366f1"
    budget_limit: Optional[Decimal] = None


class CategoryPatch(Schema):
    name: Optional[str] = None
    color: Optional[str] = None
    budget_limit: Optional[Decimal] = None


# ---------- Transactions ----------
class TransactionOut(Schema):
    id: int
    type: str
    amount: str
    category: Optional[int] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    date: DateType
    note: Optional[str] = None

    @staticmethod
    def resolve_amount(obj) -> str:
        return str(obj.amount)

    @staticmethod
    def resolve_category(obj) -> Optional[int]:
        return obj.category_id

    @staticmethod
    def resolve_category_name(obj) -> Optional[str]:
        return obj.category.name if obj.category_id else None

    @staticmethod
    def resolve_category_color(obj) -> Optional[str]:
        return obj.category.color if obj.category_id else None


class TransactionIn(Schema):
    type: str
    amount: Decimal
    category: Optional[int] = None
    date: DateType
    note: Optional[str] = None


class TransactionPatch(Schema):
    type: Optional[str] = None
    amount: Optional[Decimal] = None
    category: Optional[int] = None
    date: Optional[DateType] = None
    note: Optional[str] = None


# ---------- Assets ----------
class AssetOut(Schema):
    id: int
    name: str
    asset_type: str
    value: str
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_value(obj) -> str:
        return str(obj.value)


class AssetIn(Schema):
    name: str
    asset_type: str = "other"
    value: Decimal
    note: Optional[str] = None


class AssetPatch(Schema):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    value: Optional[Decimal] = None
    note: Optional[str] = None


# ---------- Auth ----------
class RegisterIn(Schema):
    username: str
    password: str


class LoginIn(Schema):
    username: str
    password: str


class TokenOut(Schema):
    token: str


# ---------- Profile ----------
class ProfileOut(Schema):
    username: str
    picture: Optional[str] = None
    theme: str
    language: str
    full_name: str
    email: str
    phone: str

    @staticmethod
    def resolve_username(obj) -> str:
        return obj.user.username

    @staticmethod
    def resolve_picture(obj) -> Optional[str]:
        return obj.picture.url if obj.picture else None

    @staticmethod
    def resolve_email(obj) -> str:
        return obj.user.email


class ProfilePatch(Schema):
    theme: Optional[str] = None
    language: Optional[str] = None
    full_name: Optional[str] = None
    # Not on Profile itself (see models.py) - update_profile() writes
    # this one to request.auth.email instead of the Profile row.
    email: Optional[str] = None
    phone: Optional[str] = None


# ---------- Dashboard / Reports ----------
class MonthlyTotal(Schema):
    month: str
    income: float
    expense: float
    net: float


class BreakdownItem(Schema):
    name: str
    amount: float
    color: str


class BudgetProgressItem(Schema):
    name: str
    color: str
    spent: float
    limit: float
    pct: int
    over: bool


class SummaryOut(Schema):
    month: str
    income: float
    expense: float
    net: float
    net_worth: float
    breakdown: list[BreakdownItem]
    budget_progress: list[BudgetProgressItem]
    mini_trend: list[MonthlyTotal]


class TopCategory(Schema):
    name: str
    color: str
    total: float


class ReportsOut(Schema):
    monthly_totals: list[MonthlyTotal]
    top_categories: list[TopCategory]


class ImportResult(Schema):
    imported: int
    skipped: int
    created_categories: int


class QuickAddIn(Schema):
    text: str


class ErrorOut(Schema):
    detail: str
