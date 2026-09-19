# Expense Tracker

A personal expense-tracking app: log expenses/income, see monthly totals
and a category breakdown, set per-category budgets, track 12-month trends,
and manage net-worth items. Two parts:
- **`expense-tracker/`** (this directory, minus `frontend/`) - Django,
  **API + admin only**. No HTML pages of its own beyond `/admin/`.
- **`frontend/`** - Next.js (TypeScript, App Router, Tailwind), the one
  and only UI, talking to the Django API over HTTP. See
  [frontend/README.md](frontend/README.md) for its own setup/structure.

Originally built with Flask, then migrated to Django with its own
server-rendered HTML templates, then to this Django-API + Next.js-UI
split - see CHANGELOG.md for the full history.

## Requirements
- Python 3.11+
- Node.js 20.9+ (for `frontend/`)

## Setup
Both halves need to run at once - Django as the API, Next.js as the UI.

**Django (API):**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # for /admin/
python manage.py runserver 0.0.0.0:8000
```

**Next.js (UI), in another terminal:**
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:3000 (the app) - register an account there;
it's unrelated to the Django superuser above. `/admin/` is at
http://localhost:8000/admin/ if you need to inspect/edit raw data
across every account.

The SQLite database is created automatically at `data/expenses.db` on
first `migrate`, and `CORS_ALLOWED_ORIGINS` (`config/settings.py`)
already allows the Next.js dev server's origin.

## Features
- **Accounts** - every account gets its own categories, transactions,
  and assets; nobody can see or edit another account's data.
  Registering seeds a default category set (Food & Drink, Groceries,
  Transport, Rent, Subscriptions, Bills & Utilities, Health, Shopping,
  Entertainment, Other) automatically.
- **Dashboard** - current month's income/expense/net totals and a
  net-worth card.
- **Transactions** - list + add (type, amount, category, date, note).
- **Categories** - add, recolor, delete, and set a monthly budget limit
  per category. Deleting a category does not delete its past
  transactions - they fall back to "Uncategorized".
- **Assets** (Accounting) - track net-worth items (bank accounts, cash,
  investments, property, vehicles, ...): name, type, current value.
  Total net worth shows here and on the Dashboard.
- **Settings** - change color theme, change language (English /
  Khmer - stored per-account, not yet wired up to actually translate
  the Next.js UI), upload a profile picture.
- **Admin panel** (`/admin/`) - full CRUD over every model across every
  account, courtesy of Django, no extra code required.

Not yet ported to this split: the original Django-template version's
quick-add text parsing, CSV/XLSX export/import, and per-category
budget-progress/breakdown charts on the Dashboard - see CHANGELOG.md
for what the pre-split version had; picking any of these back up means
adding the endpoint(s) to `expenses/api/` and the page/UI to
`frontend/`.

## API
A read/write JSON API lives under `/api/`, built with Django REST
Framework, scoped to the authenticated user (one account can never
read or write another's rows, by id-guessing or otherwise). This is
the only way anything - including the Next.js frontend - talks to
Django; there's no server-rendered HTML page here beyond `/admin/`.

| Endpoint | Methods |
| --- | --- |
| `/api/categories/`, `/api/categories/<id>/` | GET, POST, PUT, PATCH, DELETE |
| `/api/transactions/`, `/api/transactions/<id>/` | GET, POST, PUT, PATCH, DELETE |
| `/api/assets/`, `/api/assets/<id>/` | GET, POST, PUT, PATCH, DELETE |
| `/api/profile/` | GET, PATCH (theme, language, picture - multipart for the picture) |
| `/api/summary/` | GET `?month=YYYY-MM` (defaults to current) - income/expense/net/net_worth |
| `/api/reports/` | GET - 12-month totals + top spending categories |
| `/api/register/` | POST `{"username", "password"}` → `{"token": "..."}` (creates account) |
| `/api/token/` | POST `{"username", "password"}` → `{"token": "..."}` (existing account) |

Authenticate with a token: `POST /api/token/` or `/api/register/` to
get one, then send `Authorization: Token <token>` on every request
(`SessionAuthentication` also works, but only for a superuser already
logged into `/admin/` in the same browser - there's no other Django
session login left to get one from).

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"username": "you", "password": "..."}' \
  http://localhost:8000/api/token/
# => {"token": "abc123..."}

curl -H "Authorization: Token abc123..." http://localhost:8000/api/assets/
```

## Project structure
Grouped by concern rather than one flat folder, so a given kind of change
(a new API endpoint, a new page, a new background rule) has one obvious
place to go:

```
expense-tracker/
├── manage.py
├── config/                     # Django project - settings, root urls.py
│                                  (admin/ + api/ only), nothing else
├── expenses/                   # The one Django app - API + admin only
│   ├── models.py                 # Category, Transaction, Profile, Asset
│   ├── admin.py                   # Registers every model with /admin/
│   ├── signals.py                  # post_save(User) -> auto-create Profile
│   ├── constants.py                 # DEFAULT_CATEGORIES seeded on register
│   ├── services.py                   # get_monthly_totals() - shared by
│   │                                    /api/summary/ and /api/reports/
│   ├── dates.py                        # Pure month-arithmetic helpers
│   │
│   ├── api/                             # The JSON API - the only thing
│   │   ├── serializers.py                 the frontend ever talks to
│   │   ├── views.py
│   │   └── urls.py
│   │
│   └── migrations/                          # Schema history, including
│                                               the category-seeding and
│                                               user-backfill data migrations
├── frontend/                    # Next.js - the UI (see its own README)
├── locale/km/LC_MESSAGES/       # Khmer translation source (django.po/.mo) -
│                                  currently only reachable from /admin/
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
  internet as-is (`ALLOWED_HOSTS = ["*"]`, `DEBUG = True`,
  `CORS_ALLOWED_ORIGINS` hardcoded to localhost).
