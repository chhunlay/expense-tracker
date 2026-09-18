# Changelog

All notable changes to this project are documented in this file, grouped by
release and ordered oldest to newest.

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
