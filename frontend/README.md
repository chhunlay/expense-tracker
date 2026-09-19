# Expense Tracker - Next.js frontend

A Next.js (App Router, TypeScript, Tailwind) frontend for the Django
[expense-tracker](../) API. This is the **only** UI - the Django app
(`../`) is API + admin only, with no HTML pages of its own beyond
`/admin/`.

## Requirements
- Node.js 20.9+
- The Django API running (see the root README) - this frontend calls it
  at `NEXT_PUBLIC_API_BASE_URL` (`.env.local`, defaults to
  `http://localhost:8000`).

## Setup
```bash
npm install
npm run dev
```
Then open http://localhost:3000. In another terminal, from the repo
root, run the Django API:
```bash
cd ..
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```
Django's `CORS_ALLOWED_ORIGINS` (`config/settings.py`) already allows
`http://localhost:3000`.

## Pages
- `/login`, `/register` - call `POST /api/token/` / `POST /api/register/`
  and store the returned token in `localStorage`.
- `/dashboard` - current month's income/expense/net and net worth, from
  `GET /api/summary/`.
- `/transactions` - list + add, via `GET`/`POST /api/transactions/`.
- `/categories` - list + add + delete, via `/api/categories/`.
- `/assets` - list + add + delete + net worth total, via `/api/assets/`.
- `/reports` - 12-month totals + top spending categories, from
  `GET /api/reports/`.
- `/settings` - theme, language, and profile picture upload, via
  `GET`/`PATCH /api/profile/`.

Not built: the original Django-template version's quick-add text
parsing, CSV/XLSX export/import, per-category budget-progress bars,
and the Dashboard's trend/breakdown charts - see the root
CHANGELOG.md for what that version had.

## Project structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout - fonts, <html>/<body>, metadata
│   │   ├── page.tsx          # "/" - redirects to /dashboard or /login
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── assets/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── Header.tsx        # Nav bar + logout, shared by authenticated pages
│   │   └── RequireAuth.tsx   # Client-side redirect-to-/login guard
│   ├── lib/
│   │   ├── api.ts            # fetch wrapper - base URL, auth header, error shape
│   │   └── auth.ts           # login()/register()/logout()
│   └── types/
│       └── index.ts          # TS interfaces matching the DRF serializers
└── .env.local                # NEXT_PUBLIC_API_BASE_URL (gitignored)
```

## Auth model
No server-side session on this side - `POST /api/token/` or
`/api/register/` returns a DRF token, stored in `localStorage`
(`lib/api.ts`), and sent as `Authorization: Token <token>` on every
API call. `RequireAuth` checks for that token client-side on every
protected page and redirects to `/login` if it's missing; there's no
middleware-level route protection (yet).
