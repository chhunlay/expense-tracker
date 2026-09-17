"""
Flask app: HTTP routes only. Schema/persistence lives in db.py, date math
in dates.py, and quick-add text parsing in quick_add.py - see README.md
("Project structure") for how these fit together.
"""
import os
import sqlite3
from collections import defaultdict
from datetime import date, datetime

from flask import Flask, flash, redirect, render_template, request, url_for

from dates import month_bounds, shift_month
from db import get_db, get_monthly_totals, init_db
from quick_add import parse_quick_add

# Bump this alongside a new CHANGELOG.md entry.
__version__ = "0.3.0"

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")


@app.context_processor
def inject_version():
    return {"app_version": __version__}


@app.template_filter("money")
def money_filter(value):
    return f"${value:,.2f}"


@app.template_filter("monthlabel")
def monthlabel_filter(month_str):
    return datetime.strptime(month_str, "%Y-%m").strftime("%B %Y")


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

    # A compact 6-month trend for the dashboard's headline chart - the
    # full 12-month version with its own income/expense breakdown lives
    # on the Reports page.
    mini_months = []
    y, m = date.today().year, date.today().month
    for i in range(5, -1, -1):
        yy, mm = shift_month(y, m, -i)
        mini_months.append("%04d-%02d" % (yy, mm))
    mini_trend = get_monthly_totals(conn, mini_months)

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
        mini_trend=mini_trend,
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
        return redirect(url_for("transactions"))

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

    # 12 months, not 6 - a net-trend line needs more points than the
    # income/expense bar chart to actually show a trend rather than just
    # a handful of bars.
    months = []
    y, m = date.today().year, date.today().month
    for i in range(11, -1, -1):
        yy, mm = shift_month(y, m, -i)
        months.append("%04d-%02d" % (yy, mm))

    monthly_totals = get_monthly_totals(conn, months)

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
