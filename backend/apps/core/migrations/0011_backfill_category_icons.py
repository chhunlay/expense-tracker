"""
0010 added Category.icon with a flat default of "tag" - every category
that existed before this feature (across every account) ended up with
that same fallback, which is why the icon picker's rollout initially
showed the same icon on every row. This backfills a sensible icon
per existing category from its name via keyword matching, the same
one-time guess IconPicker's default would make if it could read names -
anything not already changed by a user, since that always stays "tag".
Frozen keyword list (not imported from live code) - a migration must
never depend on app code that can change after it's written.
"""
from django.db import migrations

# Checked in order - first keyword match wins, so put more specific
# words (e.g. "gift") before words that could appear in several
# category types.
KEYWORD_ICONS = [
    (("food", "dining", "drink", "restaurant"), "food"),
    (("grocer",), "groceries"),
    (("transport", "commut", "fuel", "gas", "uber", "taxi"), "transport"),
    (("rent", "mortgage", "household", "furniture"), "home"),
    (("maintenance", "repair"), "home"),
    (("subscription", "streaming"), "subscriptions"),
    (("bill", "utilit", "electric", "water bill"), "bills"),
    (("health", "medical", "doctor", "pharmacy", "dental"), "health"),
    (("shopping", "clothes", "clothing"), "shopping"),
    (("entertainment", "movie", "game"), "entertainment"),
    (("travel", "flight", "hotel", "vacation"), "travel"),
    (("education", "school", "tuition", "course"), "education"),
    (("gift", "donation", "charity"), "gift"),
    (("pet",), "pet"),
    (("salary", "income", "cash", "payback", "reimburse", "depreciation", "wage", "bonus", "interest", "dividend"), "cash"),
]


def icon_for_name(name: str) -> str:
    lower = name.lower()
    for keywords, icon in KEYWORD_ICONS:
        if any(k in lower for k in keywords):
            return icon
    return "tag"


def backfill_icons(apps, schema_editor):
    Category = apps.get_model("core", "Category")
    for category in Category.objects.filter(icon="tag"):
        guessed = icon_for_name(category.name)
        if guessed != "tag":
            category.icon = guessed
            category.save(update_fields=["icon"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0010_category_icon"),
    ]

    operations = [
        migrations.RunPython(backfill_icons, noop),
    ]
