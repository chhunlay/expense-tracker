"""
XLSX (Excel) export/import for transactions - same purpose and behavior
as the Flask version's xlsx_io.py, ported to the Django ORM. See
csv_io.py's docstring/comments for the shared rules (category
auto-create, row-skip conditions) - the two importers are meant to
behave identically, just reading a different file format.
"""
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

from .models import Category, Transaction

HEADERS = ["Date", "Type", "Amount", "Category", "Note"]
COLUMN_WIDTHS = [12, 10, 12, 20, 30]


def export_transactions_xlsx(user):
    """Returns `user`'s full transaction history as .xlsx file bytes."""
    rows = Transaction.objects.filter(user=user).select_related("category").order_by("date", "id")

    wb = Workbook()
    ws = wb.active
    ws.title = "Transactions"
    ws.append(HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for i, width in enumerate(COLUMN_WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width

    for t in rows:
        ws.append([t.date.isoformat(), t.type, float(t.amount), t.category.name if t.category else "", t.note or ""])

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def import_transactions_xlsx(user, file_bytes):
    """
    Reads the first sheet of an .xlsx file with the header matched
    case-insensitively regardless of column order. Returns
    (imported_count, skipped_count, created_category_count) - see
    csv_io.import_transactions_csv's docstring for the shared rules.
    """
    wb = load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    header = next(rows_iter, None)
    if not header:
        return 0, 0, 0

    col_index = {str(name).strip().lower(): i for i, name in enumerate(header) if name}

    def get(row, key):
        idx = col_index.get(key)
        return row[idx] if idx is not None and idx < len(row) else None

    categories = {c.name.lower(): c for c in Category.objects.filter(user=user)}

    imported = skipped = created_categories = 0
    for row in rows_iter:
        if row is None or all(v is None for v in row):
            continue

        raw_date = get(row, "date")
        txn_type = str(get(row, "type") or "").strip().lower()
        try:
            if isinstance(raw_date, datetime):
                txn_date = raw_date.date()
            elif isinstance(raw_date, date):
                txn_date = raw_date
            else:
                txn_date = date.fromisoformat(str(raw_date or "").strip())

            amount = float(get(row, "amount"))
            if txn_type not in ("expense", "income") or amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            skipped += 1
            continue

        category = None
        category_name = str(get(row, "category") or "").strip()
        if category_name:
            key = category_name.lower()
            if key not in categories:
                categories[key] = Category.objects.create(user=user, name=category_name, color="#6366f1")
                created_categories += 1
            category = categories[key]

        note = get(row, "note")
        note = str(note).strip() or None if note is not None else None

        Transaction.objects.create(
            user=user, date=txn_date, type=txn_type, amount=amount, category=category, note=note
        )
        imported += 1

    return imported, skipped, created_categories
