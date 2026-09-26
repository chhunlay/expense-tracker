"""
Starter categories every new account gets, applied by views.register()
when a user signs up. Migration 0002_seed_categories.py has its own
frozen copy of this same list (migrations must never import from live
app code, since models.py can change after a migration is written) -
that one only ever ran once, for the original single-user setup before
accounts existed.
"""
DEFAULT_CATEGORIES = [
    ("Food & Drink", "#f97316", "food"),
    ("Groceries", "#22c55e", "groceries"),
    ("Transport", "#38bdf8", "transport"),
    ("Rent", "#a855f7", "home"),
    ("Subscriptions", "#ec4899", "subscriptions"),
    ("Bills & Utilities", "#eab308", "bills"),
    ("Health", "#ef4444", "health"),
    ("Shopping", "#6366f1", "shopping"),
    ("Entertainment", "#14b8a6", "entertainment"),
    ("Other", "#94a3b8", "tag"),
]
