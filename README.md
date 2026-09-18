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
- **Accounts** (`/register`, `/login`, `/logout`) - every account gets its
  own categories, transactions, and assets; nobody can see or edit
  another account's data. Registering seeds the default category set
  automatically.
- **Quick add** on the dashboard - type something like `Lunch 5.50 Food` or
  `+500 Salary` and it's parsed into an amount, category (if the name is
  found in the text), and note. Prefix the amount with `+` for income.
- **Dashboard** - monthly income/expense/net totals, a category breakdown
  doughnut chart, budget progress bars, recent transactions, and a
  net-worth card linking to Assets. Navigate between months with
  Prev/Next. An eye-icon toggle blurs Income/Net in place for looking at
  the app around other people.
- **Transactions list** (`/transactions`) - filterable by month and
  category, with inline edit/delete. "+ Add" opens a popup for precise
  entry (type, amount, category, date, note); "+ Add" on Categories works
  the same way.
- **Categories** (`/categories`) - add, rename, recolor, delete, and set a
  monthly budget limit per category. Deleting a category does not delete
  its past transactions - they fall back to "Uncategorized".
- **Accounting → Assets** (`/assets`) - track net-worth items (bank
  accounts, cash, investments, property, vehicles, ...): name, type,
  current value, optional note. Total net worth shows on this page and
  on the Dashboard.
- **Settings** (`/settings`) - change color theme, change language
  (English / Khmer), upload a profile picture.
- **Reports** (`/reports`) - a 12-month net trend line, an income vs.
  expense bar chart, and a ranked list of top-spending categories.
- **CSV/XLSX export/import** (`/export/csv`, `/export/xlsx`, `/import`,
  linked from the Transactions page) - moves data between devices, since
  `data/expenses.db` is gitignored and never synced anywhere on its own.
- **JSON API** (`/api/`) - see [API](#api) below.
- **Admin panel** (`/admin/`) - full CRUD over every model, courtesy of
  Django, no extra code required.

## API
A read/write JSON API lives under `/api/`, built with Django REST
Framework, scoped to the authenticated user exactly like the web UI (one
account can never read or write another's rows, by id-guessing or
otherwise).

| Endpoint | Methods |
| --- | --- |
| `/api/categories/`, `/api/categories/<id>/` | GET, POST, PUT, PATCH, DELETE |
| `/api/transactions/`, `/api/transactions/<id>/` | GET, POST, PUT, PATCH, DELETE |
| `/api/assets/`, `/api/assets/<id>/` | GET, POST, PUT, PATCH, DELETE |
| `/api/token/` | POST `{"username", "password"}` → `{"token": "..."}` |

Two ways to authenticate:
- **Browser** - already logged in via `/login`? The session cookie just
  works (`SessionAuthentication`).
- **Scripts/mobile** - `POST /api/token/` with your username/password to
  get a token, then send `Authorization: Token <token>` on every request
  (`TokenAuthentication`).

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"username": "you", "password": "..."}' \
  http://localhost:5051/api/token/
# => {"token": "abc123..."}

curl -H "Authorization: Token abc123..." http://localhost:5051/api/assets/
```

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
Grouped by concern rather than one flat folder, so a given kind of change
(a new page, a new API endpoint, a new background rule) has one obvious
place to go:

```
expense-tracker/
├── manage.py
├── config/                     # Django project - settings, root urls.py,
│                                  nothing app-specific lives here
├── expenses/                   # The one Django app
│   ├── models.py                 # Category, Transaction, Profile, Asset
│   ├── views.py                   # Web UI - one function per page/route
│   ├── urls.py                     # Maps web routes to views.py
│   ├── admin.py                     # Registers every model with /admin/
│   ├── signals.py                    # post_save(User) -> auto-create Profile
│   ├── constants.py                   # DEFAULT_CATEGORIES seeded on register
│   ├── context_processors.py           # Sidebar nav sections + version,
│   │                                      injected into every template
│   ├── services.py                      # get_monthly_totals() - shared by
│   │                                       dashboard + reports
│   ├── dates.py                          # Pure month-arithmetic helpers
│   ├── quick_add.py                       # Quick-add text parsing
│   ├── csv_io.py / xlsx_io.py              # Export/import, via the ORM
│   │
│   ├── api/                                # JSON API - separate from the
│   │   ├── serializers.py                    web UI above so neither gets
│   │   ├── views.py                          tangled up in the other's
│   │   └── urls.py                           concerns (see API section)
│   │
│   ├── templatetags/expenses_extras.py     # money / monthlabel filters
│   ├── templates/expenses/                   # One template per page + base.html
│   ├── static/expenses/                        # style.css + script.js
│   └── migrations/                                # Schema history, including
│                                                      the category-seeding and
│                                                      user-backfill data migrations
├── locale/km/LC_MESSAGES/       # Khmer translation (django.po/.mo)
├── data/                        # SQLite database file (gitignored)
├── media/                       # Uploaded profile pictures (gitignored)
├── requirements.txt
├── CHANGELOG.md
└── README.md
```

## Notes
- Real accounts, each scoped to its own data - see Accounts above.
  `/admin/` requires a superuser (`createsuperuser`, above) and can see
  every account's data, same as any Django admin.
- Meant to run on localhost or your home LAN, not exposed to the
  internet as-is (`ALLOWED_HOSTS = ["*"]`, `DEBUG = True`).
