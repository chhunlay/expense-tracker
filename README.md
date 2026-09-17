# Expense Tracker

A small self-hosted personal expense tracker: log expenses/income, see monthly
totals and a category breakdown, set per-category budgets, and track trends
over the last 6 months.

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
  chart, budget progress bars, and recent transactions. Navigate between
  months with Prev/Next.
- **Transactions list** (`/transactions`) - filterable by month and category,
  with inline edit/delete.
- **Categories** (`/categories`) - add, rename, recolor, delete, and set a
  monthly budget limit per category. Deleting a category does not delete its
  past transactions - they fall back to "Uncategorized".
- **Reports** (`/reports`) - a 6-month income vs. expense bar chart and a
  ranked list of top-spending categories over that window.

## Notes
- Single-user, no login - meant to run on localhost or your home LAN, not be
  exposed to the internet as-is.
- Runs on port 5051 by default so it can run alongside the video-downloader
  app (port 5050) on the same machine.
