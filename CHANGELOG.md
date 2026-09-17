# Changelog

All notable changes to this project are documented in this file, grouped by
release and ordered oldest to newest.

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
