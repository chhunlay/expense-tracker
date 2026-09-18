"""
Step 2 of 3: assigns every pre-existing Category/Transaction (from
before user accounts existed) to the first superuser, so 0006 can safely
make the user field required. Falls back to the very first user if
somehow no superuser exists; does nothing if there are no users at all
yet (a truly fresh install has no rows to backfill anyway).
"""
from django.conf import settings
from django.db import migrations


def backfill(apps, schema_editor):
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Category = apps.get_model("expenses", "Category")
    Transaction = apps.get_model("expenses", "Transaction")

    owner = User.objects.filter(is_superuser=True).order_by("id").first() or User.objects.order_by("id").first()
    if owner is None:
        return

    Category.objects.filter(user__isnull=True).update(user=owner)
    Transaction.objects.filter(user__isnull=True).update(user=owner)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("expenses", "0004_accounts_and_assets")]
    operations = [migrations.RunPython(backfill, noop)]
