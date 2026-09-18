"""
Same starter categories as the Flask version's db.py DEFAULT_CATEGORIES -
seeded once via a data migration (Django's idiomatic equivalent of the
Flask app's "seed on first run if the table's empty" check in init_db()).
"""
from django.db import migrations

DEFAULT_CATEGORIES = [
    ("Food & Drink", "#f97316"),
    ("Groceries", "#22c55e"),
    ("Transport", "#38bdf8"),
    ("Rent", "#a855f7"),
    ("Subscriptions", "#ec4899"),
    ("Bills & Utilities", "#eab308"),
    ("Health", "#ef4444"),
    ("Shopping", "#6366f1"),
    ("Entertainment", "#14b8a6"),
    ("Other", "#94a3b8"),
]


def seed_categories(apps, schema_editor):
    Category = apps.get_model("expenses", "Category")
    for name, color in DEFAULT_CATEGORIES:
        Category.objects.get_or_create(name=name, defaults={"color": color})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("expenses", "0001_initial")]
    operations = [migrations.RunPython(seed_categories, noop)]
