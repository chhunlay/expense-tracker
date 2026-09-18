"""
Starter categories every new account gets, applied by views.register()
when a user signs up. Migration 0002_seed_categories.py has its own
frozen copy of this same list (migrations must never import from live
app code, since models.py can change after a migration is written) -
that one only ever ran once, for the original single-user setup before
accounts existed.
"""
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
