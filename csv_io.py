"""
CSV export/import for transactions.

data/expenses.db is never synced anywhere (see README.md "Notes") - it's
gitignored on purpose, so setting the app up on a second device starts
with an empty database. This is the way data actually moves between
devices: export a CSV on one, import it on the other.
"""
import csv
import io
from datetime import date, datetime

EXPORT_FIELDS = ["date", "type", "amount", "category", "note"]


def export_transactions_csv(conn):
    """Returns the full transaction history as CSV text."""
    rows = conn.execute(
        """
        SELECT t.date, t.type, t.amount, c.name AS category_name, t.note
        FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
        ORDER BY t.date, t.id
        """
    ).fetchall()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_FIELDS)
    for r in rows:
        writer.writerow([r["date"], r["type"], r["amount"], r["category_name"] or "", r["note"] or ""])
    return buffer.getvalue()


def import_transactions_csv(conn, file_bytes):
    """
    Inserts transactions from CSV bytes in the same shape
    export_transactions_csv produces (date, type, amount, category, note).

    A category name that doesn't already exist is created automatically
    (default color, no budget) rather than silently falling back to
    "Other" - this is meant for a full backup/restore round trip, so a
    category from the source device should survive intact rather than
    getting merged away. Rows with a missing/invalid date, type, or
    amount are skipped rather than aborting the whole import.

    Returns (imported_count, skipped_count, created_category_count).
    """
    categories = {c["name"].lower(): c["id"] for c in conn.execute("SELECT * FROM categories").fetchall()}

    stream = io.StringIO(file_bytes.decode("utf-8-sig"), newline=None)
    reader = csv.DictReader(stream)

    imported = skipped = created_categories = 0
    for row in reader:
        # Case-insensitive header match (a hand-edited "Date"/"Amount"
        # header works the same as our own lowercase export) - same
        # tolerance xlsx_io.import_transactions_xlsx applies.
        row = {(k or "").strip().lower(): v for k, v in row.items()}
        txn_date = (row.get("date") or "").strip()
        txn_type = (row.get("type") or "").strip().lower()
        try:
            date.fromisoformat(txn_date)
            amount = float(row.get("amount"))
            if txn_type not in ("expense", "income") or amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            skipped += 1
            continue

        category_id = None
        category_name = (row.get("category") or "").strip()
        if category_name:
            key = category_name.lower()
            if key not in categories:
                cur = conn.execute(
                    "INSERT INTO categories (name, color) VALUES (?, ?)",
                    (category_name, "#6366f1"),
                )
                categories[key] = cur.lastrowid
                created_categories += 1
            category_id = categories[key]

        conn.execute(
            "INSERT INTO transactions (date, type, amount, category_id, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                txn_date,
                txn_type,
                amount,
                category_id,
                (row.get("note") or "").strip() or None,
                datetime.now().isoformat(),
            ),
        )
        imported += 1

    conn.commit()
    return imported, skipped, created_categories
