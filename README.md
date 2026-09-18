# Expense Tracker (Django)

A personal expense-tracking app: log expenses/income, see monthly totals
and a category breakdown, set per-category budgets, track 12-month trends,
and export/import CSV or XLSX. Originally built with Flask; this branch
migrates it to Django (see CHANGELOG.md) to learn the framework using code
already familiar from that version.

## Requirements
- Python 3.11+

## Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # for /admin/
python manage.py runserver 0.0.0.0:5051
```
Then open http://localhost:5051 (app) or http://localhost:5051/admin/ (admin).

The SQLite database is created automatically at `data/expenses.db` on first
`migrate`, seeded with a starter set of categories (Food & Drink,
Groceries, Transport, Rent, Subscriptions, Bills & Utilities, Health,
Shopping, Entertainment, Other) via a data migration
(`expenses/migrations/0002_seed_categories.py`) - rename, delete, or add to
them freely from the Categories page afterward.

## Features
- **Quick add** on the dashboard - type something like `Lunch 5.50 Food` or
  `+500 Salary` and it's parsed into an amount, category (if the name is
  found in the text), and note. Prefix the amount with `+` for income.
- **Dashboard** - monthly income/expense/net totals, a category breakdown
  doughnut chart, budget progress bars, and recent transactions. Navigate
  between months with Prev/Next. An eye-icon toggle blurs Income/Net in
  place for looking at the app around other people.
- **Transactions list** (`/transactions`) - filterable by month and
  category, with inline edit/delete. "+ Add" opens a popup for precise
  entry (type, amount, category, date, note); "+ Add" on Categories works
  the same way.
- **Categories** (`/categories`) - add, rename, recolor, delete, and set a
  monthly budget limit per category. Deleting a category does not delete
  its past transactions - they fall back to "Uncategorized".
- **Reports** (`/reports`) - a 12-month net trend line, an income vs.
  expense bar chart, and a ranked list of top-spending categories.
- **CSV/XLSX export/import** (`/export/csv`, `/export/xlsx`, `/import`,
  linked from the Transactions page) - moves data between devices, since
  `data/expenses.db` is gitignored and never synced anywhere on its own.
- **Admin panel** (`/admin/`) - full CRUD over both models, courtesy of
  Django, no extra code required.

## What changed from the Flask version
- **Django ORM instead of raw SQL** - `expenses/models.py` defines
  `Category` and `Transaction` as real models; the old hand-written SQLite
  schema and queries become Django migrations and `.objects.filter(...)`
  calls throughout `views.py`.
- **Admin panel for free** - `/admin/` (`expenses/admin.py`) - the Flask
  version would have had to hand-build this.
- **CSRF protection built in** - Django's `CsrfViewMiddleware` requires
  `{% csrf_token %}` in every POST form; the Flask version had none.
- **`django.contrib.messages` instead of Flask's `flash()`** - same
  one-off "Transaction added" style notices, Django's own mechanism.
- **Django template syntax instead of Jinja2** - close but not identical:
  `{% url 'name' %}` instead of `url_for()`, `{% static %}` instead of
  `url_for('static', ...)`, `{{ value|json_script:"id" }}` (a Django
  built-in) instead of a hand-rolled `<script type="application/json">`
  tag, and no inline ternaries (`{{ 'active' if x else '' }}` becomes a
  real `{% if %}...{% endif %}` block).
- **Static files served via `django.contrib.staticfiles`** - `style.css`
  and `script.js` are unchanged (plain CSS/JS, framework-agnostic either
  way).

## Project structure
```
expense-tracker/
├── manage.py
├── config/                # Django project (settings, root urls.py)
├── expenses/               # The one Django app
│   ├── models.py            # Category, Transaction
│   ├── views.py              # One function per route
│   ├── urls.py                 # Maps routes to views
│   ├── admin.py                 # Registers both models with /admin/
│   ├── context_processors.py     # Sidebar nav items + version, on every page
│   ├── services.py                 # get_monthly_totals() - shared by
│   │                                  dashboard + reports
│   ├── dates.py                       # Pure month-arithmetic helpers
│   ├── quick_add.py                    # Quick-add text parsing
│   ├── csv_io.py / xlsx_io.py            # Export/import, via the ORM
│   ├── templatetags/expenses_extras.py     # money / monthlabel filters
│   ├── templates/expenses/                   # One template per view + base.html
│   ├── static/expenses/                        # style.css + script.js
│   └── migrations/                                # Schema + the category-seeding
│                                                      data migration
├── data/                    # SQLite database file (gitignored)
├── requirements.txt
├── CHANGELOG.md
└── README.md
```

## Notes
- Single-user, no real auth on the app itself - meant to run on localhost
  or your home LAN, not exposed to the internet as-is. `/admin/` does
  require login (the superuser created above).
- Runs on port 5051 by default so it can run alongside video-downloader
  (port 5050) on the same machine.
