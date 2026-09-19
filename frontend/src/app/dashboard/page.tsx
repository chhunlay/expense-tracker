"use client";

import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Doughnut, Line } from "react-chartjs-2";

import { apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { AssetsIcon, EyeIcon, EyeOffIcon } from "@/components/icons";
import { Summary, Transaction } from "@/types";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Legend, Filler);

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const HIDE_KEY = "expense-tracker-hide-amounts";
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function DashboardPage() {
  const [monthStr, setMonthStr] = useState(currentMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAdding, setQuickAdding] = useState(false);

  useEffect(() => {
    // Reads an external system (localStorage) not available during
    // SSR - see AppShell's auth-check effect for the same pattern.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      // ignore - see lib/api.ts's setToken for the same tradeoff
    }
  }, []);

  function load() {
    Promise.all([
      apiFetch<Summary>(`/api/summary?month=${monthStr}`),
      apiFetch<Transaction[]>(`/api/transactions?month=${monthStr}&limit=8`),
    ])
      .then(([s, txns]) => {
        setSummary(s);
        setRecent(txns);
      })
      .catch(() => setError("Couldn't load your summary"));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummary(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr]);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    setQuickAddError(null);
    setQuickAdding(true);
    try {
      await apiFetch("/api/quick-add", { method: "POST", body: JSON.stringify({ text: quickAddText }) });
      setQuickAddText("");
      load();
    } catch (err) {
      setQuickAddError(err instanceof ApiError ? err.message : "Couldn't add that");
    } finally {
      setQuickAdding(false);
    }
  }

  const isCurrentMonth = monthStr === currentMonth();

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthStr(shiftMonth(monthStr, -1))}
          className="nav-link rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          &larr; Prev
        </button>
        <h2 className="text-lg font-bold">
          {new Date(`${monthStr}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        {isCurrentMonth ? (
          <span className="text-faint px-3 py-1.5 text-sm">Next &rarr;</span>
        ) : (
          <button
            type="button"
            onClick={() => setMonthStr(shiftMonth(monthStr, 1))}
            className="nav-link rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            Next &rarr;
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-muted text-sm font-semibold">Overview</h3>
        <button
          type="button"
          onClick={toggleHidden}
          aria-label="Show or hide income and net amounts"
          className="theme-toggle flex h-9 w-9 items-center justify-center rounded-xl transition-opacity hover:opacity-80"
        >
          {hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {error && <p className="text-neg text-sm">{error}</p>}

      {summary && (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="kpi-card kpi-income rounded-2xl p-4">
              <p className="kpi-label mb-1 text-xs font-semibold uppercase tracking-wider">Income</p>
              <p className={`hideable-amount text-xl font-extrabold ${hidden ? "amount-hidden" : ""}`}>
                {money(summary.income)}
              </p>
            </div>
            <div className="kpi-card kpi-expense rounded-2xl p-4">
              <p className="kpi-label mb-1 text-xs font-semibold uppercase tracking-wider">Expenses</p>
              <p className="text-xl font-extrabold">{money(summary.expense)}</p>
            </div>
            <div className="kpi-card kpi-net rounded-2xl p-4">
              <p className="kpi-label mb-1 text-xs font-semibold uppercase tracking-wider">Net</p>
              <p className={`hideable-amount text-xl font-extrabold ${hidden ? "amount-hidden" : ""}`}>
                {money(summary.net)}
              </p>
            </div>
          </div>

          <div className="glass-card mb-5 flex items-center justify-between rounded-2xl p-4">
            <span className="text-muted flex items-center gap-2 text-sm font-semibold">
              <AssetsIcon /> Net worth
            </span>
            <span className={`hideable-amount text-lg font-extrabold ${hidden ? "amount-hidden" : ""}`}>
              {money(summary.net_worth)}
            </span>
          </div>

          <form onSubmit={handleQuickAdd} className="glass-card mb-5 rounded-2xl p-4">
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              Quick add
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                placeholder='e.g. "Lunch 5.50 Food" or "+500 Salary"'
                autoComplete="off"
                className="input flex-1 rounded-xl px-3 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={quickAdding || !quickAddText.trim()}
                className="action-btn rounded-xl bg-indigo-500 px-4 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {quickAddError && <p className="text-neg mt-1.5 text-xs">{quickAddError}</p>}
            <p className="text-faint mt-1.5 text-xs">
              Amount + optional category name anywhere in the text. Prefix the amount with &quot;+&quot; for income.
            </p>
          </form>

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <div className="glass-card rounded-2xl p-5 lg:col-span-2">
              <h3 className="mb-3 font-bold">Net trend (last 6 months)</h3>
              <Line
                data={{
                  labels: summary.mini_trend.map((m) => m.month),
                  datasets: [
                    {
                      label: "Net",
                      data: summary.mini_trend.map((m) => m.net),
                      borderColor: "#818cf8",
                      backgroundColor: "rgba(129, 140, 248, 0.15)",
                      fill: true,
                      tension: 0.3,
                      pointRadius: 3,
                      pointBackgroundColor: summary.mini_trend.map((m) => (m.net >= 0 ? "#34d399" : "#f87171")),
                    },
                  ],
                }}
                options={{
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: "rgba(148,163,184,0.15)" } },
                  },
                  plugins: { legend: { display: false } },
                }}
                height={140}
              />
            </div>

            <div className="glass-card rounded-2xl p-5">
              <h3 className="mb-3 font-bold">Where it went</h3>
              {summary.breakdown.length === 0 ? (
                <p className="text-faint text-sm">No expenses logged this month yet.</p>
              ) : (
                <>
                  <Doughnut
                    data={{
                      labels: summary.breakdown.map((b) => b.name),
                      datasets: [
                        {
                          data: summary.breakdown.map((b) => b.amount),
                          backgroundColor: summary.breakdown.map((b) => b.color),
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{ plugins: { legend: { display: false } }, cutout: "65%" }}
                    height={160}
                  />
                  <div className="mt-3 space-y-1.5">
                    {summary.breakdown.map((b) => (
                      <div key={b.name} className="flex items-center justify-between text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: b.color }} />
                          <span className="truncate">{b.name}</span>
                        </span>
                        <span className="text-muted ml-2 flex-shrink-0">{money(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="glass-card rounded-2xl p-5">
              <h3 className="mb-3 font-bold">Budgets</h3>
              {summary.budget_progress.length === 0 ? (
                <p className="text-faint text-sm">
                  No budgets set yet. Add a limit on the Categories page.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.budget_progress.map((b) => (
                    <div key={b.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{b.name}</span>
                        <span className="text-muted">
                          {money(b.spent)} / {money(b.limit)}
                        </span>
                      </div>
                      {/* Only the track is rounded, not the bar - the
                          track's overflow-hidden already clips the bar
                          to that same rounded shape, and having both
                          independently rounded caused a hairline
                          mismatch at the corners in some browsers
                          (the bar's own corner geometry didn't quite
                          agree with the track's clip path). */}
                      <div className="progress-track h-2 w-full overflow-hidden rounded-full">
                        <div
                          className={`progress-bar h-full ${b.over ? "over" : ""}`}
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold">Recent</h3>
                <Link href="/transactions" className="text-sm font-medium text-indigo-400">
                  View all &rarr;
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="text-faint text-sm">Nothing logged this month yet.</p>
              ) : (
                <div className="space-y-2">
                  {recent.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ background: r.category_color || "#94a3b8" }}
                        />
                        <div className="min-w-0">
                          <p className="truncate">{r.note || r.category_name || "Uncategorized"}</p>
                          <p className="text-faint text-xs">
                            {r.date} &middot; {r.category_name || "Uncategorized"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`ml-2 flex-shrink-0 font-semibold ${r.type === "income" ? "text-pos" : "text-neg"}`}
                      >
                        {r.type === "income" ? "+" : "-"}
                        {money(parseFloat(r.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
