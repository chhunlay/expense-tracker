# Expense Tracker - Next.js frontend

A Next.js (App Router, TypeScript, Tailwind) frontend for the
[expense-tracker](../) API (Django + django-ninja, in `../backend/`).
This is the **only** UI - the backend is API + admin only, with no HTML
pages of its own beyond `/admin/`.

## Requirements
- Node.js 20.9+
- The backend API running (see the root README) - this frontend calls
  it at `NEXT_PUBLIC_API_BASE_URL` (`.env.local`, defaults to
  `http://localhost:8000`).

## Setup
```bash
npm install
npm run dev
```
Then open http://localhost:3000. In another terminal, from the repo
root, run the backend:
```bash
cd ../backend
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```
The backend's `CORS_ALLOWED_ORIGINS` (`backend/config/settings.py`)
already allows `http://localhost:3000`.

## Pages
- `/login`, `/register` - call `POST /api/token` / `POST /api/register`
  and store the returned token in `localStorage`.
- `/dashboard` - current month's income/expense/net and net worth,
  a 6-month net trend chart, a category-breakdown doughnut chart, and
  budget progress bars (all from one `GET /api/summary` call, via
  chart.js/react-chartjs-2), Prev/Next month navigation, a hide/show
  toggle for sensitive amounts, a quick-add box (`POST /api/quick-add`),
  and a Recent-transactions list.
- `/transactions` - list + add (popup modal), filter by month/category,
  CSV/XLSX export and import, via `/api/transactions`, `/api/export/*`,
  `/api/import`.
- `/categories` - list (expand a row to edit) + add (popup modal) +
  delete, via `/api/categories`.
- `/assets` - same pattern, + net worth total, via `/api/assets`.
- `/reports` - 12-month totals + top spending categories, from
  `GET /api/reports`.
- `/settings` - theme, language (`GET`/`PATCH /api/profile`), and
  profile picture upload (`POST /api/profile/picture`).


## Project structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout - fonts, <html>/<body>, metadata,
│   │   │                        early theme-init script
│   │   ├── page.tsx          # "/" - redirects to /dashboard or /login
│   │   ├── globals.css       # Dark/light theme CSS variables + shared classes
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── assets/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── AppShell.tsx      # Sidebar/mobile-nav chrome + the auth guard,
│   │   │                        wraps every authenticated page
│   │   ├── Modal.tsx         # Native <dialog>-based popup (the "+ Add" forms)
│   │   ├── PasswordField.tsx # Show/hide toggle for password inputs
│   │   ├── ThemeToggle.tsx   # Dark/light pill switch
│   │   └── icons.tsx         # Plain outline SVG icon set
│   ├── lib/
│   │   ├── api.ts            # fetch wrapper - base URL, auth header, error
│   │   │                        shape, apiDownload() for file exports
│   │   ├── auth.ts           # login()/register()/logout()
│   │   └── theme.ts          # localStorage-backed theme helpers
│   └── types/
│       └── index.ts          # TS interfaces matching the Ninja schemas
└── .env.local                # NEXT_PUBLIC_API_BASE_URL (gitignored)
```

## Auth model
No server-side session on this side - `POST /api/token` or
`/api/register` returns an API token, stored in `localStorage`
(`lib/api.ts`), and sent as `Authorization: Token <token>` on every API
call. `AppShell` checks for that token client-side on every protected
page and redirects to `/login` if it's missing; there's no
middleware-level route protection (yet).
