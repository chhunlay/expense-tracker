"""
Pydantic (via django-ninja's Schema) request/response shapes - the
Ninja equivalent of the old DRF serializers.py. Decimal fields
(amount/value/budget_limit) are typed `str` on the way out so the
Next.js frontend (which already treats these as strings, e.g.
`parseFloat(a.value)`) sees no change in shape from the DRF version -
Pydantic would otherwise serialize Decimal as a JSON number.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from ninja import Schema


# ---------- Categories ----------
class CategoryOut(Schema):
    id: int
    name: str
    color: str
    budget_limit: Optional[str] = None

    @staticmethod
    def resolve_budget_limit(obj) -> Optional[str]:
        return str(obj.budget_limit) if obj.budget_limit is not None else None


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
    date: date
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


class TransactionIn(Schema):
    type: str
    amount: Decimal
    category: Optional[int] = None
    date: date
    note: Optional[str] = None


class TransactionPatch(Schema):
    type: Optional[str] = None
    amount: Optional[Decimal] = None
    category: Optional[int] = None
    date: Optional[date] = None
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

    @staticmethod
    def resolve_username(obj) -> str:
        return obj.user.username

    @staticmethod
    def resolve_picture(obj) -> Optional[str]:
        return obj.picture.url if obj.picture else None


class ProfilePatch(Schema):
    theme: Optional[str] = None
    language: Optional[str] = None


# ---------- Dashboard / Reports ----------
class SummaryOut(Schema):
    month: str
    income: float
    expense: float
    net: float
    net_worth: float


class MonthlyTotal(Schema):
    month: str
    income: float
    expense: float
    net: float


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


class ErrorOut(Schema):
    detail: str
