"""
CSV export/import for transactions - same purpose and CSV shape as the
Flask version's csv_io.py (date, type, amount, category, note), ported
to query/write through the Django ORM instead of a raw sqlite3
connection, since Django manages its own DB connection.
"""
import csv
import io
from datetime import date

from .models import Category, Transaction

EXPORT_FIELDS = ["date", "type", "amount", "category", "note"]


def export_transactions_csv():
    """Returns the full transaction history as CSV text."""
    rows = Transaction.objects.select_related("category").order_by("date", "id")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_FIELDS)
    for t in rows:
        writer.writerow([t.date.isoformat(), t.type, t.amount, t.category.name if t.category else "", t.note or ""])
    return buffer.getvalue()


def import_transactions_csv(file_bytes):
    """
    Inserts transactions from CSV bytes in the same shape
    export_transactions_csv produces (date, type, amount, category, note).

    A category name that doesn't already exist is created automatically
    (default color, no budget) rather than silently falling back to
    "Other" - this is meant for a full backup/restore round trip, so a
    category from the source device should survive intact. Rows with a
    missing/invalid date, type, or amount are skipped rather than
    aborting the whole import.

    Returns (imported_count, skipped_count, created_category_count).
    """
    categories = {c.name.lower(): c for c in Category.objects.all()}

    stream = io.StringIO(file_bytes.decode("utf-8-sig"), newline=None)
    reader = csv.DictReader(stream)

    imported = skipped = created_categories = 0
    for row in reader:
        # Case-insensitive header match (a hand-edited "Date"/"Amount"
        # header works the same as our own lowercase export).
        row = {(k or "").strip().lower(): v for k, v in row.items()}
        txn_date_str = (row.get("date") or "").strip()
        txn_type = (row.get("type") or "").strip().lower()
        try:
            txn_date = date.fromisoformat(txn_date_str)
            amount = float(row.get("amount"))
            if txn_type not in ("expense", "income") or amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            skipped += 1
            continue

        category = None
        category_name = (row.get("category") or "").strip()
        if category_name:
            key = category_name.lower()
            if key not in categories:
                categories[key] = Category.objects.create(name=category_name, color="#6366f1")
                created_categories += 1
            category = categories[key]

        Transaction.objects.create(
            date=txn_date,
            type=txn_type,
            amount=amount,
            category=category,
            note=(row.get("note") or "").strip() or None,
        )
        imported += 1

    return imported, skipped, created_categories
