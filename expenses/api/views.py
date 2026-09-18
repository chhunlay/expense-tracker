"""
DRF viewsets - one per model, each scoped to request.user in
get_queryset (so /api/... never leaks another account's rows, mirroring
the same rule the regular views.py enforces) and perform_create (so a
new row is always owned by whoever created it, never a user id the
client could pass in).
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from expenses.models import Asset, Category, Transaction

from .serializers import AssetSerializer, CategorySerializer, TransactionSerializer


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
