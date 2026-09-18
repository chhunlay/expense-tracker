"""
Same two-table shape as the Flask version's db.py, expressed as Django
models instead of raw SQL - this is the ORM doing what db.py's
get_db()/init_db() did by hand (schema definition, and Django's
migrations replace the manual CREATE TABLE IF NOT EXISTS).
"""
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    color = models.CharField(max_length=7, default="#6366f1")
    budget_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Transaction(models.Model):
    EXPENSE = "expense"
    INCOME = "income"
    TYPE_CHOICES = [(EXPENSE, "Expense"), (INCOME, "Income")]

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
