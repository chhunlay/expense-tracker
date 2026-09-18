"""
Step 1 of 3 for adding real user accounts: user FK added as nullable for
now (existing Category/Transaction rows have no owner yet) - 0005
backfills them to the admin account, then 0006 makes the field required.
Also drops Category.name's old global-unique constraint (it becomes
unique per-user instead, added in 0006) and adds the new Profile/Asset
models in one pass since neither has any pre-existing data to worry
about.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("expenses", "0003_alter_category_options"),
    ]

    operations = [
        migrations.AlterField(
            model_name="category",
            name="name",
            field=models.CharField(max_length=100),
        ),
        migrations.AddField(
            model_name="category",
            name="user",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="categories",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="user",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="transactions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name="Profile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("picture", models.ImageField(blank=True, null=True, upload_to="profile_pictures/")),
                ("theme", models.CharField(choices=[("dark", "Dark"), ("light", "Light")], default="dark", max_length=5)),
                ("language", models.CharField(default="en", max_length=10)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Asset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150)),
                (
                    "asset_type",
                    models.CharField(
                        choices=[
                            ("bank", "Bank account"),
                            ("cash", "Cash"),
                            ("investment", "Investment"),
                            ("property", "Property"),
                            ("vehicle", "Vehicle"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=12,
                    ),
                ),
                ("value", models.DecimalField(decimal_places=2, max_digits=12)),
                ("note", models.CharField(blank=True, max_length=255, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assets",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-value"]},
        ),
    ]
