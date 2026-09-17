"""
XLSX (Excel) export/import for transactions - same purpose as csv_io.py
(moving data between devices as a plain file, since data/expenses.db
itself is never synced anywhere) for anyone who wants a real formatted
spreadsheet instead of a plain-text CSV. Behavior and return shape match
csv_io.py's functions exactly, so callers can treat the two formats as
interchangeable.
"""
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

HEADERS = ["Date", "Type", "Amount", "Category", "Note"]
COLUMN_WIDTHS = [12, 10, 12, 20, 30]


def export_transactions_xlsx(conn):
    """Returns the full transaction history as .xlsx file bytes."""
    rows = conn.execute(
        """
        SELECT t.date, t.type, t.amount, c.name AS category_name, t.note
        FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
        ORDER BY t.date, t.id
        """
    ).fetchall()

    wb = Workbook()
    ws = wb.active
    ws.title = "Transactions"
    ws.append(HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for i, width in enumerate(COLUMN_WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width

    for r in rows:
        ws.append([r["date"], r["type"], r["amount"], r["category_name"] or "", r["note"] or ""])

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def import_transactions_xlsx(conn, file_bytes):
    """
    Reads the first sheet of an .xlsx file. The header row is matched
    case-insensitively against Date/Type/Amount/Category/Note rather than
    assuming a fixed column order, so a hand-edited spreadsheet with
    reordered columns still imports correctly.

    Category auto-create and row-skip rules match
    csv_io.import_transactions_csv exactly (see its docstring) - the two
    importers are meant to behave identically, just reading a different
    file format.

    Returns (imported_count, skipped_count, created_category_count).
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

    categories = {c["name"].lower(): c["id"] for c in conn.execute("SELECT * FROM categories").fetchall()}

    imported = skipped = created_categories = 0
    for row in rows_iter:
        if row is None or all(v is None for v in row):
            continue

        raw_date = get(row, "date")
        txn_type = str(get(row, "type") or "").strip().lower()
        try:
            if isinstance(raw_date, datetime):
                txn_date = raw_date.date().isoformat()
            elif isinstance(raw_date, date):
                txn_date = raw_date.isoformat()
            else:
                txn_date = str(raw_date or "").strip()
            date.fromisoformat(txn_date)

            amount = float(get(row, "amount"))
            if txn_type not in ("expense", "income") or amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            skipped += 1
            continue

        category_id = None
        category_name = str(get(row, "category") or "").strip()
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

        note = get(row, "note")
        note = str(note).strip() or None if note is not None else None

        conn.execute(
            "INSERT INTO transactions (date, type, amount, category_id, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (txn_date, txn_type, amount, category_id, note, datetime.now().isoformat()),
        )
        imported += 1

    conn.commit()
    return imported, skipped, created_categories
