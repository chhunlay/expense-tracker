# Expense Tracker

A small self-hosted personal expense tracker: log expenses/income, see monthly
totals and a category breakdown, set per-category budgets, and track trends
over the last 12 months. See [CHANGELOG.md](CHANGELOG.md) for release history;
the current version is shown in the footer of every page.

## Requirements
- Python 3.11+

## Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Then open http://localhost:5051

The SQLite database is created automatically at `data/expenses.db` on first
run, seeded with a starter set of categories (Food & Drink, Groceries,
Transport, Rent, Subscriptions, Bills & Utilities, Health, Shopping,
Entertainment, Other) that you can rename, delete, or add to from the
Categories page.

## Features
- **Quick add** on the dashboard - type something like `Lunch 5.50 Food` or
  `+500 Salary` and it's parsed into an amount, category (if the name is
  found in the text), and note. Prefix the amount with `+` for income.
- **Full form** (`/add`) for precise entry - type, amount, category, date, note.
- **Dashboard** - monthly income/expense/net totals, a category breakdown
  doughnut chart, budget progress bars, and recent transactions. Navigate
  between months with Prev/Next.
- **Transactions list** (`/transactions`) - filterable by month and category,
  with inline edit/delete.
- **Categories** (`/categories`) - add, rename, recolor, delete, and set a
  monthly budget limit per category. Deleting a category does not delete its
  past transactions - they fall back to "Uncategorized".
- **Reports** (`/reports`) - a 12-month net trend line, an income vs. expense
  bar chart, and a ranked list of top-spending categories over that window.
- **CSV/XLSX export/import** (`/export/csv`, `/export/xlsx`, `/import`,
  linked from the Transactions page) - see "Moving data between devices"
  below.
- **Hide amounts** - an eye-icon toggle on the dashboard blurs Income and Net
  (not Expenses) in place, for looking at the app around other people.

## Project structure
```
expense-tracker/
├── app.py            # Flask app + HTTP routes only (thin controllers)
├── db.py             # SQLite schema, connection helper, seed categories
├── dates.py          # Pure month-arithmetic helpers (nav + report windows)
├── quick_add.py       # Parses the dashboard's one-line quick-add text
├── csv_io.py           # CSV export/import for moving data between devices
├── xlsx_io.py           # Same, as a real .xlsx file (via openpyxl)
├── templates/         # Jinja2 pages (one file per route) + base.html layout
├── static/
│   ├── style.css       # Theme (CSS variables, dark/light) + component styles
│   └── script.js       # Theme toggle + flash-message auto-dismiss
├── data/               # SQLite database file (gitignored, created on first run)
├── requirements.txt
├── CHANGELOG.md
└── README.md
```
Each route in `app.py` follows the same shape: open a connection with
`db.get_db()`, run the query/queries for that page, `conn.close()`, then
`render_template(...)`. There's no ORM and no ODB session state to manage -
if you're adding a new page, that four-step shape is the pattern to copy.

**Why split like this:** `app.py` is the only file that touches Flask
(routes, `request`, `flash`, `render_template`). `db.py`, `dates.py`, and
`quick_add.py` are plain Python with no Flask import, which keeps the schema,
date math, and quick-add parsing independently readable and testable (e.g.
`python -c "from quick_add import parse_quick_add; ..."` works with no app
context needed).

## Database schema
Two tables, defined in `db.py`:
- **`categories`**: `id`, `name` (unique), `color` (hex), `budget_limit`
  (nullable - unset means no budget bar shown for that category).
- **`transactions`**: `id`, `date` (`YYYY-MM-DD`), `type` (`expense` or
  `income`), `amount`, `category_id` (nullable FK, `ON DELETE SET NULL` so
  deleting a category doesn't delete its transaction history), `note`
  (nullable), `created_at` (insert timestamp, used only for ordering ties).

## Moving data between devices
`data/expenses.db` is in `.gitignore` on purpose - your personal transaction
history is never pushed to a git remote. That means setting the app up fresh
on a second device starts with an **empty** database, not your existing data.
To carry data over, either:
- **Export/Import CSV or XLSX** (built in) - click "Export CSV" or "Export
  XLSX" on the Transactions page on the source device, then "Import" on the
  destination device (it accepts either format). Round-trips every
  transaction; a category name that doesn't exist yet on the destination is
  created automatically.
- **Copy the file directly** - copy `data/expenses.db` itself onto the other
  device's `data/` folder. Simpler for a one-time full move, but all-or-
  nothing (overwrites whatever's already there) and only works file-to-file,
  not through a browser.

## Notes
- Single-user, no login - meant to run on localhost or your home LAN, not be
  exposed to the internet as-is.
- Runs on port 5051 by default so it can run alongside the video-downloader
  app (port 5050) on the same machine.
