# Expense Tracker

A personal expense-tracking app: log expenses/income, see monthly totals,
track 12-month trends, and manage net-worth items. A decoupled monorepo,
two independent apps under one root:
- **`backend/`** - Django + [django-ninja](https://django-ninja.dev/),
  **API + admin only**. No HTML pages of its own beyond `/admin/`.
- **`frontend/`** - Next.js (TypeScript, App Router, Tailwind), the one
  and only UI, talking to the API over HTTP. See
  [frontend/README.md](frontend/README.md) for its own setup/structure.

Originally built with Flask, then migrated to Django with its own
server-rendered HTML templates, then to a Django-API + Next.js-UI split,
then to this `backend/`+`frontend/` layout with the API rebuilt on
django-ninja (dropping Django REST Framework) - see CHANGELOG.md for the
full history.

## Requirements
- Python 3.11+
- Node.js 20.9+ (for `frontend/`)

## Setup
Both halves need to run at once - Django as the API, Next.js as the UI.

**Backend (API):**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # for /admin/
python manage.py runserver 0.0.0.0:8000
```

**Frontend (UI), in another terminal:**
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:3000 (the app) - register an account there;
it's unrelated to the Django superuser above. `/admin/` is at
http://localhost:8000/admin/ if you need to inspect/edit raw data
across every account. The interactive API docs (Ninja's built-in Swagger
UI) are at http://localhost:8000/api/docs.

The SQLite database is created automatically at `backend/data/expenses.db`
on first `migrate`, and `CORS_ALLOWED_ORIGINS` (`backend/config/settings.py`)
already allows the Next.js dev server's origin.

## Features
- **Accounts** - every account gets its own categories, transactions,
  and assets; nobody can see or edit another account's data.
  Registering seeds a default category set (Food & Drink, Groceries,
  Transport, Rent, Subscriptions, Bills & Utilities, Health, Shopping,
  Entertainment, Other) automatically.
- **Dashboard** - current month's income/expense/net totals, a net-worth
  card, Prev/Next month navigation, a hide/show toggle for sensitive
  amounts, a quick-add box (type `Lunch 5.50 Food & Drink` or
  `+500 Salary`), a 6-month net trend chart, a category-breakdown
  doughnut chart, per-category budget progress bars, and a
  Recent-transactions list.
- **Transactions** - list, add (popup form), filter by month/category,
  CSV/XLSX export and import.
- **Categories** - add, recolor, delete, and set a monthly budget limit
  per category. Deleting a category does not delete its past
  transactions - they fall back to "Uncategorized".
- **Assets** (Accounting) - track net-worth items (bank accounts, cash,
  investments, property, vehicles, ...): name, type, current value.
  Total net worth shows here and on the Dashboard.
- **Settings** - change color theme, change language (English /
  Khmer - stored per-account, not yet wired up to actually translate
  the Next.js UI), upload a profile picture.
- **Dark/light theme toggle**, same pill switch on every page.
- **Admin panel** (`/admin/`) - full CRUD over every model across every
  account, courtesy of Django, no extra code required.

## API
A read/write JSON API lives under `/api/`, built with
[django-ninja](https://django-ninja.dev/) (Pydantic schemas, typed
function-based routes - see `backend/apps/core/api.py`/`schemas.py`),
scoped to the authenticated user (one account can never read or write
another's rows, by id-guessing or otherwise). This is the only way
anything - including the Next.js frontend - talks to Django; there's no
server-rendered HTML page here beyond `/admin/`. Routes have **no
trailing slash** (Ninja's convention, unlike the old DRF setup).

| Endpoint | Methods |
| --- | --- |
| `/api/categories`, `/api/categories/{id}` | GET, POST, PATCH, DELETE |
| `/api/transactions`, `/api/transactions/{id}` | GET (`?month=`, `?category_id=`, `?limit=`), POST, PATCH, DELETE |
| `/api/assets`, `/api/assets/{id}` | GET, POST, PATCH, DELETE |
| `/api/profile` | GET, PATCH (theme, language) |
| `/api/profile/picture` | POST (multipart, field `picture`) |
| `/api/summary` | GET `?month=YYYY-MM` (defaults to current) - income/expense/net/net_worth, category breakdown, budget progress, 6-month trend |
| `/api/quick-add` | POST `{"text"}` - e.g. `"Lunch 5.50 Food & Drink"` or `"+500 Salary"` |
| `/api/reports` | GET - 12-month totals + top spending categories |
| `/api/export/csv`, `/api/export/xlsx` | GET - full transaction-history file download |
| `/api/import` | POST (multipart, field `file`) - import a `.csv`/`.xlsx` |
| `/api/register` | POST `{"username", "password"}` → `{"token": "..."}` (creates account) |
| `/api/token` | POST `{"username", "password"}` → `{"token": "..."}` (existing account) |

Authenticate with a token: `POST /api/token` or `/api/register` to get
one, then send `Authorization: Token <token>` on every request (a
from-scratch `AuthToken` model + `security.py`'s `TokenAuth` - not
Django REST Framework's `rest_framework.authtoken`, since the API no
longer depends on DRF at all).

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"username": "you", "password": "..."}' \
  http://localhost:8000/api/token
# => {"token": "abc123..."}

curl -H "Authorization: Token abc123..." http://localhost:8000/api/assets
```

## Project structure
A decoupled monorepo - `backend/` and `frontend/` are independent apps
under one root, communicating only over HTTP (never importing each
other's code). Within `backend/`, grouped by concern so a given kind of
change (a new endpoint, a new model, a new background rule) has one
obvious place to go:

```
expense-tracker/
├── backend/                      # 🐍 Django + Ninja API
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                     # Project configuration root
│   │   ├── settings.py               # Global Django settings
│   │   ├── urls.py                    # Core routing (mounts api.py)
│   │   └── api.py                      # Global NinjaAPI() + router mount
│   ├── apps/
│   │   └── core/                    # The one Django app - API + admin only
│   │       ├── models.py              # Category, Transaction, Profile,
│   │       │                            Asset, AuthToken
│   │       ├── schemas.py              # Pydantic request/response shapes
│   │       ├── security.py              # TokenAuth (Authorization: Token ...)
│   │       ├── api.py                    # All endpoints (Ninja router)
│   │       ├── admin.py                   # Registers every model with /admin/
│   │       ├── signals.py                  # post_save(User) -> auto-create Profile
│   │       ├── constants.py                 # DEFAULT_CATEGORIES seeded on register
│   │       ├── services.py                   # get_monthly_totals() - shared by
│   │       │                                    /api/summary and /api/reports
│   │       ├── dates.py                        # Pure month-arithmetic helpers
│   │       ├── csv_io.py / xlsx_io.py            # Export/import, via the ORM
│   │       └── migrations/                        # Schema history
│   ├── locale/km/LC_MESSAGES/       # Khmer translation source (django.po/.mo) -
│   │                                   currently only reachable from /admin/
│   ├── data/                        # SQLite database file (gitignored)
│   └── media/                       # Uploaded profile pictures (gitignored)
├── frontend/                     # ⚛️ Next.js UI (see its own README)
│   ├── src/app/                    # Routing and pages
│   ├── src/components/              # Shared UI (Header, Modal, icons, ...)
│   ├── src/lib/                      # api.ts (fetch wrapper), auth.ts, theme.ts
│   └── src/types/                     # TypeScript interfaces
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
