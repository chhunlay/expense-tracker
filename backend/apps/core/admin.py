from django.contrib import admin

from .models import Asset, AuthToken, Category, Profile, SavedSearch, Transaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "color", "budget_limit")
    list_filter = ("user",)
    search_fields = ("name",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("date", "user", "type", "amount", "category", "note")
    list_filter = ("type", "category", "user", "date")
    search_fields = ("note",)
    date_hierarchy = "date"


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "theme", "language")


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "asset_type", "value")
    list_filter = ("asset_type", "user")
    search_fields = ("name",)


@admin.register(SavedSearch)
class SavedSearchAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "page", "group_by", "is_default")
    list_filter = ("page", "user")
    search_fields = ("name",)


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "key", "created_at")
    search_fields = ("user__username",)
