"""
Database layer: schema, connection helper, and seed data.

Raw sqlite3 is used directly instead of an ORM - this app is single-user
and the query set is small enough that plain SQL stays easy to read and
there's no real need for the extra layer.
"""
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "expenses.db")

# Seeded into the categories table on first run only - the user can
# rename/recolor/delete/add to these freely afterward from the
# Categories page, so this list is never referenced again after setup.
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


def get_db():
    """Open a new connection with dict-like row access. Caller closes it."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create tables if they don't exist yet and seed default categories."""
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#6366f1',
            budget_limit REAL
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
            amount REAL NOT NULL,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            note TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    if conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO categories (name, color) VALUES (?, ?)", DEFAULT_CATEGORIES
        )
    conn.commit()
    conn.close()
