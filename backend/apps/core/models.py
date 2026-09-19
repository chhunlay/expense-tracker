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
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#6366f1")
    budget_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

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
