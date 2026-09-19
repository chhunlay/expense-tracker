"""
DRF viewsets - one per model, each scoped to request.user in
get_queryset (so /api/... never leaks another account's rows, mirroring
the same rule the regular views.py enforces) and perform_create (so a
new row is always owned by whoever created it, never a user id the
client could pass in).
"""
from datetime import date

from django.db.models import Sum
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from expenses.constants import DEFAULT_CATEGORIES
from expenses.dates import month_bounds
from expenses.models import Asset, Category, Transaction

from .serializers import AssetSerializer, CategorySerializer, RegisterSerializer, TransactionSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related("category")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Asset.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Same account-creation flow as views.register (the HTML form) -
    seeds the default categories - but returns a token so the Next.js
    frontend can log the new account straight in, the same way
    /api/token/ does for an existing one."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    Category.objects.bulk_create(
        [Category(user=user, name=name, color=color) for name, color in DEFAULT_CATEGORIES]
    )
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def summary(request):
    """Dashboard aggregates for the current month - the same numbers
    views.dashboard computes for the HTML page (income/expense/net,
    net worth), as one endpoint instead of making the frontend re-derive
    them from the raw transaction/asset lists."""
    month_str = request.GET.get("month") or date.today().strftime("%Y-%m")
    start, end = month_bounds(month_str)
    rows = Transaction.objects.filter(user=request.user, date__gte=start, date__lt=end)
    income = float(rows.filter(type=Transaction.INCOME).aggregate(t=Sum("amount"))["t"] or 0)
    expense = float(rows.filter(type=Transaction.EXPENSE).aggregate(t=Sum("amount"))["t"] or 0)
    net_worth = float(Asset.objects.filter(user=request.user).aggregate(t=Sum("value"))["t"] or 0)
    return Response({
        "month": month_str,
        "income": income,
        "expense": expense,
        "net": income - expense,
        "net_worth": net_worth,
    })
