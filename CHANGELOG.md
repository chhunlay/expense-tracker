# Changelog

All notable changes to this project are documented in this file, grouped by
release and ordered oldest to newest.

## [3.3.1] - 2026-09-26
### Fixed
- Categories created before the icon picker (3.3.0) all defaulted to
  the same generic tag icon. A data migration now backfills a sensible
  icon per existing category by matching keywords in its name (e.g.
  "Food & Dining" -> food, "Salary"/"Cash Advanced" -> cash,
  "Rent"/"Household Items" -> home) - anything already picked by a
  user going forward is unaffected.

## [3.3.0] - 2026-09-26
### Added
- Categories can now be given an icon (a fixed set of stroke-outline
  icons matching the sidebar's own style, picked from a new IconPicker
  popover next to the existing color swatch on the Categories page,
  both when adding a category and when editing one inline). New
  `Category.icon` field (`backend/apps/core/models.py`), included in
  `GET/POST/PATCH /api/categories` and in the Dashboard summary's
  `budget_progress` entries.
### Changed
- Dashboard Budgets list now shows each category's icon next to its
  name and sorts rows by amount spent, highest first, instead of
  category name order.

## [3.2.0] - 2026-09-20
### Added
- **Transactions gained an Odoo-style search panel**: a single Filter
  icon (merged into the search bar itself, with a visible grey/accent
  hover state) opens a three-column panel:
  - **Filters** - category checklist and a new **Date** picker (this
    month + the two before it, plus this year's four quarters,
    recomputed live from today's date) - both collapsed by default
    unless already active. Backend `GET /api/transactions` gained
    `category_ids` (comma-separated, replacing single-category
    filtering), `date_from`/`date_to` (a quarter can't be expressed as
    one `month`).
  - **Group By** - bucket the table by Category, Type, or Month
    (toggle a choice on/off by clicking it again; no "None" option
    needed), with a colored subtotal row per group.
  - **Favorites** - save the current filter+group combo by name,
    optionally marking it default (checkable at save time or via a
    star afterward) so it auto-applies on the next page load. New
    `SavedSearch` model + `GET/POST/PATCH/DELETE /api/saved-searches`.
  - Active filters/group-by show as removable, solid-accent-colored
    chips inside the search box (Backspace clears the last one, same
    convention as Gmail's To field); the box also now filters by note
    text.
  - The Amount column header is now clickable to sort
    ascending/descending/off, replacing a separate Min/Max range pair.
- Category rows expand into their edit form on hover instead of
  requiring a click, and their color swatch opens a small in-app
  preset palette (dismissible by moving the mouse away) instead of the
  native OS color picker, which needed its own explicit close.
- **A real client-side translation system** (`frontend/src/lib/i18n.ts`):
  Settings' Language picker is now radio buttons, and picking Khmer
  (ភាសាខ្មែរ) actually translates the sidebar nav, headings, and common
  actions across the app - it previously only patched the profile
  record with no visible effect. Sourced from the original pre-Next.js
  Django app's leftover `.po` catalog rather than re-translated from
  scratch; newer features added since that version intentionally fall
  back to English.
- Logging out now asks for confirmation (Yes/No modal) instead of
  signing out immediately on click.
- Settings' success/error messages are now a small fading toast in the
  top-right corner instead of an inline paragraph; per-account favicon
  upload; Dashboard's Analytics "Avg" stat is labeled with its actual
  unit (day/week/month, matching the Trend filter's granularity).
- The Dashboard trend chart's Income and Expense lines now fill under
  the curve the same way Net already did, instead of being outlined
  only.
### Changed
- Every card across the app (`glass-card`) switched from a frosted-
  glass blur to a solid background + soft shadow - besides the look,
  `backdrop-filter` forces a new CSS stacking context, which was
  trapping the Transactions filter dropdown's `z-index` below the
  table card that followed it in the DOM.
- The "Trend chart series" checkboxes in Settings (and the chart's own
  legend) now look like radio buttons while keeping independent
  multi-select semantics, with at least one series always required to
  stay selected; per-series accent coloring on that row was dropped.
- Settings' profile section is auto-save on blur (no manual Save
  button); a field that hasn't actually changed no longer re-saves and
  re-flashes a toast just from clicking in and out of it.
### Fixed
- The sidebar (and the auth-check/profile-fetch it runs) no longer
  fully remounts on every navigation - every page used to wrap itself
  in its own `<AppShell>`, so Next.js tore down and rebuilt the whole
  shell on each route change. Fixed via a `(app)` route group sharing
  one `layout.tsx`/`AppShell` instance across `dashboard/`,
  `transactions/`, `categories/`, `reports/`, `assets/`, `settings/`.
- The Trend chart's legend kept listing a series as struck-through
  after hiding it, because datasets were marked `hidden` but never
  actually removed from the array passed to Chart.js - now filtered
  out entirely.

## [3.1.0] - 2026-09-19
### Added
- **Dashboard reaches full parity with the original Django-template
  version**: a 6-month net trend line chart, a category-breakdown
  doughnut chart (with a color-swatch legend), per-category budget
  progress bars, and the quick-add box (`"Lunch 5.50 Food & Drink"` /
  `"+500 Salary"`) - all previously called out as "not yet ported".
  - Backend: `GET /api/summary` now also returns `breakdown`,
    `budget_progress`, and `mini_trend` (the same computation
    `views.dashboard` used to do, restored from git history) instead
    of just the four top-line numbers; `POST /api/quick-add` is a new
    endpoint wrapping the restored `apps/core/quick_add.py` parser
    (unchanged text-parsing logic, just re-added).
  - Frontend: added `chart.js` + `react-chartjs-2` for the two charts,
    matching the exact chart config (colors, tension, cutout) the old
    Chart.js-based templates used.
- Diagnosed a "no default category in the Add transaction dropdown"
  report: the `admin` superuser was created directly via
  `createsuperuser`, bypassing `/api/register`'s category-seeding -
  seeded it manually as a one-off fix (not a code bug - a normal
  registered account was never affected).

## [3.0.0] - 2026-09-19
### Changed
- **Restructured into a decoupled `backend/` + `frontend/` monorepo**
  and **rebuilt the API on [django-ninja](https://django-ninja.dev/),
  dropping Django REST Framework entirely.**
  - `manage.py`, `config/`, the app, `data/`, `media/`, `locale/`, and
    `requirements.txt` all moved under a new `backend/` directory.
  - The app itself moved from `expenses/` to `backend/apps/core/` (app
    label `core`, was `expenses`) - a fresh `0001_initial` migration
    replaces the old history, since renaming a Django app label isn't
    a clean in-place migration; the local SQLite dev database was
    reset (it's gitignored, disposable local data).
  - `expenses/api/serializers.py` + `views.py` + `urls.py` (DRF) are
    replaced by `apps/core/schemas.py` (Pydantic request/response
    shapes) and `apps/core/api.py` (one Ninja `Router` with every
    endpoint, decorators instead of a separate urls.py).
  - Token auth no longer depends on
    `rest_framework.authtoken.models.Token` - a new self-contained
    `AuthToken` model (`apps/core/models.py`) plus `TokenAuth`
    (`apps/core/security.py`, a Ninja auth class) replace it, still
    parsing the same `Authorization: Token <key>` header the frontend
    already sends.
  - **API routes no longer have a trailing slash** (Ninja's
    convention, e.g. `/api/categories` not `/api/categories/`) -
    `frontend/`'s `lib/api.ts` calls and `lib/auth.ts` updated to
    match.
  - The profile-picture upload split into its own endpoint
    (`POST /api/profile/picture`, multipart) instead of being folded
    into `PATCH /api/profile` - Ninja doesn't mix a JSON-schema body
    and a file upload on one operation as cleanly as DRF's parser
    stack did; `frontend/`'s Settings page updated to match.
  - Ninja's built-in interactive API docs are live at `/api/docs`.
- Removed a leftover `expenses/static/expenses/script.js` that had
  survived the earlier "Django API-only" cleanup by mistake (nothing
  serves it).
### Fixed
- `.gitignore`'s `data/*.db` pattern was root-anchored (a gitignore
  pattern containing a slash before the last segment only matches at
  the repo root) and silently stopped matching once the SQLite file
  moved to `backend/data/`; changed to `**/data/*.db` so it matches at
  any depth.

## [2.0.0] - 2026-09-19
### Changed
- **Django is now API + admin only.** Removed every Django-rendered
  HTML page (`expenses/templates/`, `expenses/static/`,
  `expenses/templatetags/`), `expenses/views.py`, `expenses/urls.py`,
  and `expenses/context_processors.py` - the Next.js frontend
  (`frontend/`) is the only UI now. `config/urls.py` no longer has an
  HTML `"/"` route; `LOGIN_URL`/`LOGIN_REDIRECT_URL`/
  `LOGOUT_REDIRECT_URL` (config/settings.py) are gone since nothing
  uses Django's session-based `@login_required`/`LoginView` flow
  anymore - the Next.js frontend authenticates entirely via API tokens.
- Also removed `expenses/quick_add.py`, `expenses/csv_io.py`, and
  `expenses/xlsx_io.py` - they only existed to support the
  now-deleted HTML views (quick-add text parsing, CSV/XLSX
  export/import) and have no API equivalent yet.
### Added
- Rounded out the Next.js frontend to full page parity with what the
  Django templates used to cover: `/categories`, `/assets`,
  `/reports`, `/settings` (theme, language, profile picture upload).
- Three new API endpoints to support them: `GET`/`PATCH /api/profile/`
  (a per-user singleton, supporting a multipart PATCH for the picture
  upload), and `GET /api/reports/` (12-month totals + top spending
  categories, the same numbers the old Reports page rendered).
### Removed (not yet ported to the new split)
- Quick-add text parsing, CSV/XLSX export/import, per-category budget
  progress bars, and the Dashboard's trend/breakdown charts - these
  existed in the Django-template version but have no API endpoint or
  Next.js page yet. Re-adding any of them means building both.

## [1.4.0] - 2026-09-19
### Added
- **Next.js frontend** (`frontend/`) - a separate TypeScript/App
  Router/Tailwind app that talks to the Django REST API instead of
  using the Django HTML templates. Covers login, register, Dashboard,
  and Transactions (list + add) for this first pass; Categories,
  Assets, Reports, and Settings are still Django-only. Auth is
  token-based (`localStorage`, `Authorization: Token ...`), via two
  new API endpoints:
  - `POST /api/register/` - same account-creation flow as the HTML
    `/register` form (seeds default categories), returns a token.
  - `GET /api/summary/` - the Dashboard's income/expense/net/net-worth
    numbers in one call, computed the same way `views.dashboard` does.
- `django-cors-headers`, configured to allow the Next.js dev server's
  origin (`http://localhost:3000`) to call the API cross-origin.

## [1.3.0] - 2026-09-18
### Changed
- Simplified several emoji icons (nav, logout, login/register logo) to
  plain monochrome outline SVGs via a new `icon_svg` template filter;
  reverted the dark/light theme toggle's icon back to 🌙/☀️ emoji after
  trying an SVG swap.
- Replaced the square theme-toggle button with a pill-shaped switch
  (moon on a dark track, sun sliding to a light track).
- Added a show/hide toggle to the password fields on login/register.
- Static CSS/JS now load with a `?v={app_version}` cache-busting query
  string, so a version bump reliably invalidates a browser's cached
  copy instead of silently serving stale styles/scripts.
- Added a warm cream/yellow/orange/coral color palette, scoped to just
  the login/register **card** in light theme (`.glass-card` under
  `html.auth-page[data-theme="light"]`) - the page background and the
  rest of the app keep the original indigo/white light theme.

## [1.2.0] - 2026-09-18
### Added
- **JSON API** under `/api/` (Django REST Framework, not FastAPI - kept
  in the same process/app so it shares the existing models, auth, and
  DB instead of standing up a second service). CRUD endpoints for
  Categories, Transactions, and Assets, each scoped to the
  authenticated user in `get_queryset`/`perform_create` the same way
  the web views are - one account can't read or write another's rows
  even by guessing an id. Two auth options: the existing session
  cookie for browser use, or `POST /api/token/` for a token
  (`TokenAuthentication`) for scripts/mobile clients.
- New `expenses/api/` subpackage (`serializers.py`, `views.py`,
  `urls.py`) keeps the API's code separate from the web UI's
  `views.py`/`urls.py` rather than mixing the two.

## [1.1.0] - 2026-09-18
### Added
- **Real user accounts.** Register/log in/log out (`django.contrib.auth`);
  every category, transaction, and asset now belongs to a `user` FK,
  scoped so each account only ever sees and touches its own data.
  Registering seeds the same 10 default categories the app always
  shipped with. Every view is `@login_required`.
- **Settings page** - change color theme (persisted per-user on a new
  `Profile` model), change language, and upload a profile picture
  (`Pillow`/`ImageField`, served from `/media/` in `DEBUG`). The
  picture and username now show at the bottom of the sidebar, with a
  logout button next to the theme toggle.
- **Accounting → Assets** - a new nav section and page for tracking
  net-worth items (bank accounts, cash, investments, property,
  vehicles, etc.): name, type, current value, optional note, same
  add/edit/delete popup pattern as Categories. Total net worth is
  shown on the Assets page and as a link-through card on the
  Dashboard.
- **Khmer (ភាសាខ្មែរ) translation** - full UI coverage via Django's
  i18n framework (`{% translate %}`/`{% blocktranslate %}` in every
  template, `gettext` in views), switchable from Settings. Language
  choice is stored per-user on `Profile` and applied via a cookie
  (`LocaleMiddleware`/`django_language`, the mechanism Django 6
  replaced session-based language storage with).
### Changed
- Nav is now grouped into sections (`nav_sections` context processor)
  so "Accounting" can header the Assets link without being clickable
  itself.

## [1.0.0] - 2026-09-18
### Changed
- **Migrated the whole app from Flask to Django**, on the
  `django-migration` branch, as a learning exercise using code already
  familiar from the Flask version. Same features, same look (Tailwind,
  `style.css`/`script.js` carried over unchanged), same SQLite file
  convention (`data/expenses.db`) - different framework underneath:
  - Raw SQL (`db.py`) → Django ORM models (`expenses/models.py`),
    migrations replacing the hand-written schema.
  - Flask routes (`app.py`) → one view per route in `expenses/views.py`.
  - Jinja2 templates → Django templates (`{% url %}`, `json_script`,
    real `{% if %}` blocks instead of inline ternaries).
  - `flash()` → `django.contrib.messages`.
  - No CSRF protection → Django's built-in `CsrfViewMiddleware` on
    every POST form.
  - New: `/admin/` - a full CRUD panel over both models, free from
    Django, with zero extra code.
  - `dates.py` and `quick_add.py` carried over near-verbatim (pure
    Python, no framework dependency either way); `csv_io.py`/
    `xlsx_io.py` ported to query through the ORM instead of a raw
    `sqlite3` connection.
  - Default port 5051 (unchanged) - `python manage.py runserver
    0.0.0.0:5051` instead of `python app.py`.

## [0.10.0] - 2026-09-18
### Reverted
- Reverted the custom date picker (0.9.0-0.9.1) back to the native
  `<input type="date">` on both the Add-transaction popup and the
  Edit-transaction page. Themed correctly, but inserted its calendar
  panel inline in the page flow - inside a popup with limited height,
  that pushed content down far enough that picking a date meant
  scrolling first, which is worse than the theme mismatch it was meant
  to fix. Back to the plain native input's usual behavior; the
  color-scheme fix from 0.7.0 stays in place for it.

## [0.9.1] - 2026-09-18
### Fixed
- The custom date picker's panel never had explicit `top`/`left`
  positioning set - it relied on the browser's default "static
  position" fallback for an absolutely positioned element, which is
  fragile and could shift or misalign depending on viewport width. Now
  explicitly anchored (`top-full left-0`) with a `max-width` clamp so it
  can never overflow past a narrow screen's edge (verified with no
  overflow at 1280px down to 320px).

### Added
- Click the month/year label (e.g. "September 2026") to jump straight
  into a 12-month grid for that year, with year Prev/Next - the same
  quick-jump shortcut the old native picker's own dropdown offered,
  instead of only single-month-at-a-time Prev/Next.

## [0.9.0] - 2026-09-18
### Changed
- Replaced the native `<input type="date">` with a custom-built date
  picker (plain themed DOM/CSS, no library) everywhere a date field
  appears (the Add-transaction popup, the Edit-transaction page). The
  native browser calendar overlay could ignore the page's theme
  entirely on some browsers/versions - it appears to follow the OS-level
  system appearance for that specific widget rather than the page's own
  `color-scheme`, a real limitation outside our CSS's control. The new
  picker is fully themed and always matches.

### Fixed
- Along the way, caught and fixed a real bug in the picker's own first
  version: Prev/Next month navigation re-renders the calendar's HTML,
  which replaced the very button that was just clicked - the "close on
  outside click" listener then saw that (now-detached) click target as
  no longer inside the picker and closed it immediately on every
  Prev/Next click. Fixed via one delegated click listener on the picker
  panel with `stopPropagation()`, instead of one listener per (soon-to-
  be-replaced) button.
- Also caught: the picker's hidden field was a real
  `<input type="hidden">`, which has no "dirty value" tracking in the
  HTML spec - once JS set its value, that silently became the new
  default too, making the Cancel-then-reopen flow's `form.reset()` a
  no-op on it (reopening after Cancel kept showing the previously-picked
  date instead of resetting to today). Switched to a `type="text"` input
  hidden via CSS instead, which supports normal reset semantics.

## [0.8.0] - 2026-09-17
### Removed
- The standalone `/add` page - adding a transaction now only happens
  through the popup on the Transactions page. `/add` is POST-only going
  forward (a GET now returns 405 instead of rendering a page).

### Changed
- The `_transaction_fields.html` partial shared between that old page
  and the popup is gone too - the popup's form fields are self-
  contained again (duplicated by hand instead of shared via include).

## [0.7.0] - 2026-09-17
### Added
- "+ Add" on the Categories page now opens the add-category form as a
  popup, same as the Transactions page's Add-transaction popup - both
  now share one `openModal(id)` helper in script.js instead of each
  wiring up its own open/reset/backdrop-click-to-close logic.

### Fixed
- The Add-transaction popup's card rendered muddy gray instead of a
  clean white in light theme (its translucent background picked up the
  popup's dark dimming overlay through its own blur effect); popups now
  use a solid background instead.
- The date picker inside the Add-transaction popup could still render
  in dark styling even with light theme active - `color-scheme` is now
  set directly on the popup element itself instead of only relying on
  it cascading down from the page, which isn't always reliable for an
  open `<dialog>`.

## [0.6.0] - 2026-09-17
### Added
- "+ Add" on the Transactions page now opens the add-transaction form as
  a popup (native `<dialog>`) instead of navigating to `/add` - same
  fields, shared with the standalone `/add` page (still reachable
  directly) via a new `_transaction_fields.html` partial so the two
  never drift apart. Opens on click, closes on Cancel/outside-click/Esc,
  and resets any leftover input each time it's reopened.

### Changed
- The Export dropdown on the Transactions page now opens on hover as
  well as click (previously click-only).

## [0.5.0] - 2026-09-17
### Added
- Real `.xlsx` export/import (`xlsx_io.py`, via the `openpyxl` library),
  alongside the existing CSV support - "Export XLSX" button on the
  Transactions page, and the import page/route now accepts either
  format and dispatches on the uploaded file's extension. Both
  importers match column headers case-insensitively regardless of
  order, and behave identically otherwise (same category auto-create
  and row-skip rules).
- The `/import/csv` route is now the unified `/import` (accepts both
  formats); update any bookmark to the old URL.

## [0.4.0] - 2026-09-17
### Added
- CSV export/import for transactions (`csv_io.py`), so data can move
  between devices - `data/expenses.db` is gitignored and never synced
  anywhere on its own. "Export CSV" and "Import CSV" buttons added to
  the Transactions page header. A category name in an imported CSV
  that doesn't exist yet is created automatically; malformed rows (bad
  date, type, or amount) are skipped rather than aborting the import.
- Show/hide toggle for the dashboard's Income and Net amounts (not
  Expenses) - blurs the real numbers in place via a CSS filter, styled
  after a banking app's balance-privacy toggle, with the hidden state
  persisted in localStorage across page loads.

## [0.3.0] - 2026-09-17
### Changed
- Redesigned the layout around a persistent sidebar (desktop) / pill nav
  (mobile) instead of a centered top nav bar, and gradient KPI cards for
  Income/Expenses/Net on the dashboard.
- Dashboard now includes its own 6-month net trend line chart alongside
  the category breakdown doughnut, matching the fuller trend view on
  the Reports page (which reuses the same `get_monthly_totals` query
  helper in `db.py` instead of duplicating it).
- Category-color dots and budget-bar widths moved from inline
  `style="...{{ }}"` attributes to `data-color`/`data-width` attributes
  applied by `script.js` at runtime - same rendered result, but no
  template syntax inside a `style` attribute for an editor's embedded
  CSS checker to misparse.

## [0.2.0] - 2026-09-17
### Added
- Net trend line chart on the Reports page (income minus expenses per
  month), with points colored green/red depending on whether that month
  came out ahead or over.
- Widened the Reports page's time window from 6 to 12 months, for both
  the new net trend chart and the existing income-vs-expenses chart and
  top-categories list.

## [0.1.1] - 2026-09-17
### Fixed
- Category rename/budget update crashed with a 500 error instead of a
  friendly message when the new name collided with an existing category.
- Dashboard and Reports charts rendered blank - the Chart.js build loaded
  from cdnjs was an ES module (`chart.min.js`), which throws when loaded
  via a plain `<script src>` tag. Switched to the UMD build
  (`chart.umd.min.js`), which defines the `Chart` global classic scripts
  need.

## [0.1.0] - 2026-09-17
### Added
- Initial release: Flask + SQLite personal expense tracker.
- Quick-add bar on the dashboard (e.g. `"Lunch 5.50 Food"` or
  `"+500 Salary"`) that parses an amount, optional category match, and
  note from one line of text.
- Full add/edit/delete form for precise transaction entry.
- Dashboard with monthly income/expense/net totals, a category
  breakdown doughnut chart, per-category budget progress bars, recent
  transactions, and month navigation.
- Transactions list filterable by month and category.
- Categories page to add/rename/recolor/delete categories and set a
  monthly budget limit per category (deleting a category keeps its past
  transactions, filed under "Uncategorized").
- Reports page with a 6-month income-vs-expense bar chart and a ranked
  top-spending-categories list.
