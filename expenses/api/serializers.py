"""
DRF serializers for the read/write JSON API - one per model that's
exposed. `user` is deliberately never a writable field on any of
these: it's always set from request.user in the viewset
(perform_create), never trusted from client input, so one account can
never write data into another account by guessing an id.
"""
from rest_framework import serializers

from expenses.models import Asset, Category, Transaction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "color", "budget_limit"]


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)

    class Meta:
        model = Transaction
        fields = ["id", "type", "amount", "category", "category_name", "date", "note"]

    def validate_category(self, category):
        # Cross-account guard: DRF's PrimaryKeyRelatedField queryset is
        # global by default, so without this a user could pass another
        # account's category id and attach a transaction to it.
        request = self.context["request"]
        if category is not None and category.user_id != request.user.id:
            raise serializers.ValidationError("Category not found.")
        return category


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = ["id", "name", "asset_type", "value", "note", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]
