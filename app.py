import os
import re
import sqlite3
from collections import defaultdict
from datetime import date, datetime

from flask import Flask, flash, jsonify, redirect, render_template, request, url_for

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "expenses.db")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")

# Seeded on first run only - the user can rename/delete/add to these freely
# afterward from the Categories page.
DEFAULT_CATEGORIES = [
    ("Food & Drink", "#f97316"),
    ("Groceries", "#22c55e"),
    ("Transport", "#38bdf8"),
    ("Rent", "#a855f7"),
    ("Subscriptions", "#ec4899"),
    ("Bills & Utilities", "#eab308"),
    ("Health", "#ef4444"),
    ("Shopping", "#6366f1"),
    ("Entertainment", "#14b8a6"),
    ("Other", "#94a3b8"),
]


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#6366f1',
            budget_limit REAL
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
            amount REAL NOT NULL,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            note TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    if conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO categories (name, color) VALUES (?, ?)", DEFAULT_CATEGORIES
        )
    conn.commit()
    conn.close()


def shift_month(year, month, delta):
    """(2026, 1, -1) -> (2025, 12); (2026, 12, 1) -> (2027, 1)."""
    idx = year * 12 + (month - 1) + delta
    return idx // 12, idx % 12 + 1


def month_bounds(month_str):
    """'2026-09' -> ('2026-09-01', '2026-10-01') half-open range for SQL."""
    year, mo = (int(p) for p in month_str.split("-"))
    start = f"{year:04d}-{mo:02d}-01"
    ny, nm = shift_month(year, mo, 1)
    end = f"{ny:04d}-{nm:02d}-01"
    return start, end


@app.template_filter("money")
def money_filter(value):
    return f"${value:,.2f}"


@app.template_filter("monthlabel")
def monthlabel_filter(month_str):
    return datetime.strptime(month_str, "%Y-%m").strftime("%B %Y")


def parse_quick_add(text, categories):
    """
    Turns a one-line quick-add like "Lunch 5.50 Food" into a transaction
    dict, or None if no amount could be found at all.

    - The first number in the text is the amount. A leading '+' on it
      (e.g. "+500 salary") marks it as income instead of an expense.
    - If any existing category name appears as a whole word/phrase
      anywhere in the remaining text, that transaction is filed under
      it (and the match is stripped from the note); otherwise it's left
      uncategorized and the caller falls back to "Other".
    - Whatever's left after removing the amount and matched category
      becomes the note.
    """
    match = re.search(r"([+-]?\d+(?:\.\d{1,2})?)", text)
    if not match:
        return None

    raw_amount = match.group(1)
    amount = abs(float(raw_amount))
    txn_type = "income" if raw_amount.startswith("+") else "expense"

    remainder = (text[: match.start()] + text[match.end() :]).strip()
    remainder = re.sub(r"\s+", " ", remainder)

    matched_category = None
    for cat in sorted(categories, key=lambda c: -len(c["name"])):
        pattern = r"(?i)\b" + re.escape(cat["name"]) + r"\b"
        if re.search(pattern, remainder):
            matched_category = cat
            remainder = re.sub(pattern, "", remainder, count=1, flags=re.IGNORECASE)
            remainder = re.sub(r"\s+", " ", remainder).strip(" -,")
            break

    return {
        "amount": amount,
        "type": txn_type,
        "category_id": matched_category["id"] if matched_category else None,
        "note": remainder or None,
    }


@app.route("/")
def dashboard():
    conn = get_db()
    categories = conn.execute("SELECT * FROM categories ORDER BY name").fetchall()

    month_str = request.args.get("month") or date.today().strftime("%Y-%m")
    start, end = month_bounds(month_str)
    year, mo = (int(p) for p in month_str.split("-"))
    prev_month = "%04d-%02d" % shift_month(year, mo, -1)
    next_month = "%04d-%02d" % shift_month(year, mo, 1)

    rows = conn.execute(
        """
        SELECT t.*, c.name AS category_name, c.color AS category_color
        FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.date >= ? AND t.date < ?
        ORDER BY t.date DESC, t.id DESC
        """,
        (start, end),
    ).fetchall()

    total_expense = sum(r["amount"] for r in rows if r["type"] == "expense")
    total_income = sum(r["amount"] for r in rows if r["type"] == "income")

    breakdown_totals = defaultdict(float)
    breakdown_colors = {}
    for r in rows:
        if r["type"] != "expense":
            continue
        name = r["category_name"] or "Uncategorized"
        breakdown_totals[name] += r["amount"]
        breakdown_colors[name] = r["category_color"] or "#94a3b8"

    breakdown = [
        {"name": name, "amount": amount, "color": breakdown_colors[name]}
        for name, amount in sorted(breakdown_totals.items(), key=lambda kv: -kv[1])
    ]

    budget_progress = []
    for c in categories:
        if not c["budget_limit"]:
            continue
        spent = breakdown_totals.get(c["name"], 0.0)
        budget_progress.append(
            {
                "name": c["name"],
                "color": c["color"],
                "spent": spent,
                "limit": c["budget_limit"],
                "pct": min(100, round(spent / c["budget_limit"] * 100)),
                "over": spent > c["budget_limit"],
            }
        )

    conn.close()
    return render_template(
        "dashboard.html",
        month_str=month_str,
        prev_month=prev_month,
        next_month=next_month,
        is_current_month=month_str == date.today().strftime("%Y-%m"),
        total_expense=total_expense,
        total_income=total_income,
        net=total_income - total_expense,
        breakdown=breakdown,
        budget_progress=budget_progress,
        recent=rows[:8],
        categories=categories,
        today=date.today().isoformat(),
    )


@app.route("/quick-add", methods=["POST"])
def quick_add():
    text = request.form.get("text", "").strip()
    conn = get_db()
    categories = conn.execute("SELECT * FROM categories").fetchall()
    parsed = parse_quick_add(text, categories) if text else None

    if not parsed:
        conn.close()
        flash('Couldn\'t find an amount in that - try something like "Lunch 5.50 Food"', "error")
        return redirect(url_for("dashboard", month=request.form.get("month")))

    if parsed["category_id"] is None:
        other = conn.execute("SELECT id FROM categories WHERE name = 'Other'").fetchone()
        parsed["category_id"] = other["id"] if other else None

    conn.execute(
        "INSERT INTO transactions (date, type, amount, category_id, note, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            date.today().isoformat(),
            parsed["type"],
            parsed["amount"],
            parsed["category_id"],
            parsed["note"],
            datetime.now().isoformat(),
        ),
    )
    conn.commit()
    conn.close()
    flash(f"Added {parsed['type']} of {parsed['amount']:.2f}", "success")
    return redirect(url_for("dashboard", month=request.form.get("month")))


@app.route("/add", methods=["GET", "POST"])
def add_transaction():
    conn = get_db()
    if request.method == "POST":
        conn.execute(
            "INSERT INTO transactions (date, type, amount, category_id, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                request.form["date"],
                request.form["type"],
                float(request.form["amount"]),
                request.form.get("category_id") or None,
                request.form.get("note") or None,
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
        conn.close()
        flash("Transaction added", "success")
        return redirect(url_for("dashboard"))

    categories = conn.execute("SELECT * FROM categories ORDER BY name").fetchall()
    conn.close()
    return render_template("add.html", categories=categories, today=date.today().isoformat())


@app.route("/edit/<int:txn_id>", methods=["GET", "POST"])
def edit_transaction(txn_id):
    conn = get_db()
    if request.method == "POST":
        conn.execute(
            "UPDATE transactions SET date = ?, type = ?, amount = ?, category_id = ?, note = ? "
            "WHERE id = ?",
            (
                request.form["date"],
                request.form["type"],
                float(request.form["amount"]),
                request.form.get("category_id") or None,
                request.form.get("note") or None,
                txn_id,
            ),
        )
        conn.commit()
        conn.close()
        flash("Transaction updated", "success")
        return redirect(url_for("transactions"))

    txn = conn.execute("SELECT * FROM transactions WHERE id = ?", (txn_id,)).fetchone()
    if txn is None:
        conn.close()
        flash("Transaction not found", "error")
        return redirect(url_for("transactions"))
    categories = conn.execute("SELECT * FROM categories ORDER BY name").fetchall()
    conn.close()
    return render_template("edit.html", txn=txn, categories=categories)


@app.route("/delete/<int:txn_id>", methods=["POST"])
def delete_transaction(txn_id):
    conn = get_db()
    conn.execute("DELETE FROM transactions WHERE id = ?", (txn_id,))
    conn.commit()
    conn.close()
    flash("Transaction deleted", "success")
    return redirect(request.referrer or url_for("dashboard"))


@app.route("/transactions")
def transactions():
    conn = get_db()
    categories = conn.execute("SELECT * FROM categories ORDER BY name").fetchall()

    month = request.args.get("month", "")
    category_id = request.args.get("category_id", "")

    query = (
        "SELECT t.*, c.name AS category_name, c.color AS category_color "
        "FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE 1=1"
    )
    params = []
    if month:
        query += " AND t.date LIKE ?"
        params.append(f"{month}%")
    if category_id:
        query += " AND t.category_id = ?"
        params.append(category_id)
    query += " ORDER BY t.date DESC, t.id DESC"

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return render_template(
        "transactions.html", rows=rows, categories=categories, month=month, category_id=category_id
    )


@app.route("/categories", methods=["GET", "POST"])
def categories_view():
    conn = get_db()
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            name = request.form.get("name", "").strip()
            if name:
                try:
                    conn.execute(
                        "INSERT INTO categories (name, color, budget_limit) VALUES (?, ?, ?)",
                        (
                            name,
                            request.form.get("color") or "#6366f1",
                            request.form.get("budget_limit") or None,
                        ),
                    )
                    conn.commit()
                    flash("Category added", "success")
                except sqlite3.IntegrityError:
                    flash("A category with that name already exists", "error")
        elif action == "update":
            try:
                conn.execute(
                    "UPDATE categories SET name = ?, color = ?, budget_limit = ? WHERE id = ?",
                    (
                        request.form["name"].strip(),
                        request.form.get("color") or "#6366f1",
                        request.form.get("budget_limit") or None,
                        request.form["id"],
                    ),
                )
                conn.commit()
                flash("Category updated", "success")
            except sqlite3.IntegrityError:
                flash("A category with that name already exists", "error")
        elif action == "delete":
            # Transactions in this category fall back to "Uncategorized"
            # (category_id NULL) rather than being deleted - a category
            # rename/cleanup should never destroy spending history.
            conn.execute("DELETE FROM categories WHERE id = ?", (request.form["id"],))
            conn.commit()
            flash("Category deleted", "success")
        conn.close()
        return redirect(url_for("categories_view"))

    categories = conn.execute(
        """
        SELECT c.*,
            COALESCE((SELECT SUM(amount) FROM transactions
                      WHERE category_id = c.id AND type = 'expense'
                        AND date >= date('now', 'start of month')), 0) AS spent_this_month
        FROM categories c ORDER BY c.name
        """
    ).fetchall()
    conn.close()
    return render_template("categories.html", categories=categories)


@app.route("/reports")
def reports():
    conn = get_db()

    months = []
    y, m = date.today().year, date.today().month
    for i in range(5, -1, -1):
        yy, mm = shift_month(y, m, -i)
        months.append("%04d-%02d" % (yy, mm))

    monthly_totals = []
    for ms in months:
        row = conn.execute(
            "SELECT COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expense, "
            "COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) AS income "
            "FROM transactions WHERE date LIKE ?",
            (f"{ms}%",),
        ).fetchone()
        monthly_totals.append({"month": ms, "expense": row["expense"], "income": row["income"]})

    top_categories = conn.execute(
        """
        SELECT c.name, c.color, COALESCE(SUM(t.amount), 0) AS total
        FROM categories c
        LEFT JOIN transactions t
            ON t.category_id = c.id AND t.type = 'expense' AND t.date >= ?
        GROUP BY c.id
        HAVING total > 0
        ORDER BY total DESC
        """,
        (f"{months[0]}-01",),
    ).fetchall()
    conn.close()
    return render_template("reports.html", monthly_totals=monthly_totals, top_categories=top_categories)


if __name__ == "__main__":
    init_db()
    # 5051, not 5050 - the video-downloader app already claims that port
    # when both run on the same machine.
    app.run(host="0.0.0.0", debug=True, port=5051)
