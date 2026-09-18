"""
Shared query helpers - the Django-ORM equivalent of db.py's
get_monthly_totals() in the Flask version. Kept separate from views.py
for the same reason: reused by both the dashboard's mini trend chart and
the full Reports page.
"""
from django.db.models import Case, DecimalField, Sum, When

from .models import Transaction


def get_monthly_totals(months):
    """income/expense/net for each 'YYYY-MM' string in `months`, in order."""
    totals = []
    for ms in months:
        agg = Transaction.objects.filter(date__year=int(ms[:4]), date__month=int(ms[5:7])).aggregate(
            income=Sum(
                Case(When(type=Transaction.INCOME, then="amount"), default=0, output_field=DecimalField())
            ),
            expense=Sum(
                Case(When(type=Transaction.EXPENSE, then="amount"), default=0, output_field=DecimalField())
            ),
        )
        income = agg["income"] or 0
        expense = agg["expense"] or 0
        totals.append({"month": ms, "income": float(income), "expense": float(expense), "net": float(income - expense)})
    return totals
