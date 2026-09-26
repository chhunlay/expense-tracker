"""
Category/Transaction are the same two tables as before, now scoped to a
user (each user manages their own - added for real accounts). Profile
extends Django's built-in User with the extra per-account preferences
the Settings page needs (profile picture, theme, language) that don't
belong on User itself. Asset is the new Accounting feature - net-worth
items (bank accounts, cash, investments, property, ...) a user owns.
AuthToken is a self-contained replacement for
rest_framework.authtoken.models.Token, since the API layer no longer
depends on Django REST Framework at all (see api.py/security.py) -
same shape (a random hex key per user), just not borrowed from a
library we otherwise don't use.
"""
import secrets

from django.conf import settings
from django.db import models


class Category(models.Model):
    EXPENSE = "expense"
    INCOME = "income"
    TYPE_CHOICES = [(EXPENSE, "Expense"), (INCOME, "Income")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#6366f1")
    # Which side of a transaction this category is meant for - lets the
    # transaction form narrow its category dropdown to just Expense or
    # Income categories instead of listing both at once.
    type = models.CharField(max_length=7, choices=TYPE_CHOICES, default=EXPENSE)
    budget_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # One of ICON_CHOICES below - picked from a fixed set of stroke-style
    # icons on the frontend (frontend/src/lib/categoryIcons.tsx), not
    # freeform, so a bad value there always has TagIcon to fall back to.
    ICON_CHOICES = [
        ("food", "Food"),
        ("groceries", "Groceries"),
        ("transport", "Transport"),
        ("home", "Home"),
        ("subscriptions", "Subscriptions"),
        ("bills", "Bills"),
        ("health", "Health"),
        ("shopping", "Shopping"),
        ("entertainment", "Entertainment"),
        ("travel", "Travel"),
        ("education", "Education"),
        ("gift", "Gift"),
        ("cash", "Cash"),
        ("pet", "Pet"),
        ("tag", "Other"),
    ]
    icon = models.CharField(max_length=20, choices=ICON_CHOICES, default="tag")

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"
        # Unique per-user, not globally - two different users can both
        # have a "Rent" category without colliding.
        constraints = [models.UniqueConstraint(fields=["user", "name"], name="unique_category_name_per_user")]

    def __str__(self):
        return self.name


class Transaction(models.Model):
    EXPENSE = "expense"
    INCOME = "income"
    TYPE_CHOICES = [(EXPENSE, "Expense"), (INCOME, "Income")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    date = models.DateField()
    type = models.CharField(max_length=7, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    # SET_NULL, not CASCADE - deleting a category should never delete
    # the transactions that used it, same behavior as the Flask
    # version's ON DELETE SET NULL foreign key.
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.date} {self.type} {self.amount}"


class Profile(models.Model):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"
    THEME_CHOICES = [(SYSTEM, "System"), (LIGHT, "Light"), (DARK, "Dark")]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    picture = models.ImageField(upload_to="profile_pictures/", blank=True, null=True)
    # Per-account override for the browser tab icon - falls back to
    # the app's own static favicon.ico when unset (see AppShell's
    # applyFavicon(), which only ever points <link rel="icon"> here
    # when this is set).
    favicon = models.ImageField(upload_to="favicons/", blank=True, null=True)
    # Default is SYSTEM (follow the OS/browser preference), not DARK -
    # matches the frontend's own first-visit fallback in
    # THEME_INIT_SCRIPT (lib/theme.ts) for a brand new account.
    theme = models.CharField(max_length=6, choices=THEME_CHOICES, default=SYSTEM)
    # Mirrors settings.LANGUAGES' codes ("en"/"km") - kept as a plain
    # CharField rather than validated against LANGUAGES directly so a
    # future added language doesn't need a migration.
    language = models.CharField(max_length=10, default="en")
    full_name = models.CharField(max_length=150, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    # Email lives on the built-in User model (settings.AUTH_USER_MODEL
    # already has one, so there's no reason to duplicate it here) -
    # ProfileOut/ProfilePatch read and write it through user.email.

    def __str__(self):
        return f"{self.user.username}'s profile"


class Asset(models.Model):
    BANK = "bank"
    CASH = "cash"
    INVESTMENT = "investment"
    PROPERTY = "property"
    VEHICLE = "vehicle"
    OTHER = "other"
    TYPE_CHOICES = [
        (BANK, "Bank account"),
        (CASH, "Cash"),
        (INVESTMENT, "Investment"),
        (PROPERTY, "Property"),
        (VEHICLE, "Vehicle"),
        (OTHER, "Other"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assets")
    name = models.CharField(max_length=150)
    asset_type = models.CharField(max_length=12, choices=TYPE_CHOICES, default=OTHER)
    value = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-value"]

    def __str__(self):
        return self.name


class SavedSearch(models.Model):
    """A saved combination of filters + a group-by choice for a given
    page (currently only "transactions"), created from that page's
    Favorites tab. One per user can be marked is_default, which the
    page applies automatically on load instead of starting blank -
    the equivalent of Odoo's "Favorites" search-panel column."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_searches")
    page = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    # Filters, stored as plain strings rather than a real FK/JSON field
    # since this only ever needs to round-trip back into the same
    # querystring-shaped filters the Transactions page already sends -
    # "" means "no filter on this", not "filter to an empty value".
    month = models.CharField(max_length=7, blank=True, default="")
    date_from = models.CharField(max_length=10, blank=True, default="")
    date_to = models.CharField(max_length=10, blank=True, default="")
    category_ids = models.CharField(max_length=255, blank=True, default="")
    # e.g. "category,date:quarter" - a "date" entry carries its
    # granularity inline since there's no separate column for it.
    group_by = models.CharField(max_length=50, blank=True, default="")
    # Whether applying this search should show its groups folded
    # (collapsed to just the totals line) or expanded - defaults to
    # folded, matching the page's own default behavior whenever
    # Group By is turned on.
    fold_groups = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.user.username}'s '{self.name}' ({self.page})"


class AuthToken(models.Model):
    """One active token per user, checked by security.py's TokenAuth on
    every authenticated request (Authorization: Token <key>) - the same
    role rest_framework.authtoken.models.Token played before the API
    moved off Django REST Framework."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_token")
    key = models.CharField(max_length=40, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = secrets.token_hex(20)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Token for {self.user.username}"
