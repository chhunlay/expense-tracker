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
import type { Plugin } from "chart.js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Doughnut, Line } from "react-chartjs-2";

import { apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- only used by the Net worth card, commented out below
import { AssetsIcon, EyeIcon, EyeOffIcon } from "@/components/icons";
import { getStoredTrendHidden, setStoredTrendHidden } from "@/lib/theme";
import { Summary, Transaction } from "@/types";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Legend, Filler);

// Which trend-chart point is "today" - can't be inferred from the
// label text alone now that This Week (Mon-Sun) and This Month (1st
// through the last day) both run past today into the future, so the
// last point is no longer necessarily "now". Mirrors the exact
// bucketing api.py's summary() endpoint uses for each range.
function getTodayIndexForRange(trendRange: string): number {
  const today = new Date();
  if (trendRange === "this_week") return (today.getDay() + 6) % 7; // Mon=0 .. Sun=6
  if (trendRange === "this_month") return Math.ceil(today.getDate() / 7) - 1; // 7-day buckets from the 1st
  return -1; // month-based ranges always end on the current month - last point is "today"
}

// Marks today's point on the trend chart, matching the dashed "Today"
// divider from the reference forecast-chart screenshot the user
// shared.
function createTodayLinePlugin(todayIndex: number): Plugin<"line"> {
  return {
    id: "todayLine",
    afterDraw(chart) {
      const labels = chart.data.labels as string[] | undefined;
      if (!labels || labels.length < 2) return;
      const index = todayIndex >= 0 && todayIndex < labels.length ? todayIndex : labels.length - 1;
      const x = chart.scales.x.getPixelForValue(index);
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.textAlign = x > chartArea.right - 40 ? "right" : "left";
      ctx.fillText("Today", x + (ctx.textAlign === "right" ? -6 : 6), chartArea.top + 12);
      ctx.restore();
    },
  };
}

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Highest and average value across the Trend chart's current points
 * for one series - shown under the "Analytics" heading, per series,
 * only for series that aren't toggled off in the chart's legend. */
function seriesStats(values: number[]): { high: number; avg: number } {
  if (values.length === 0) return { high: 0, avg: 0 };
  return { high: Math.max(...values), avg: values.reduce((sum, v) => sum + v, 0) / values.length };
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const HIDE_KEY = "expense-tracker-hide-amounts";
const currentMonth = () => new Date().toISOString().slice(0, 7);

const TREND_RANGES = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "current_year", label: "Current Year" },
] as const;

export default function DashboardPage() {
  const [monthStr, setMonthStr] = useState(currentMonth);
  const [trendRange, setTrendRange] = useState<string>("this_month");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [hiddenDatasets, setHiddenDatasets] = useState<Set<string>>(new Set());
  const [quickAddText, setQuickAddText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- only used by the Quick add form, commented out below
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- only used by the Quick add form, commented out below
  const [quickAdding, setQuickAdding] = useState(false);

  useEffect(() => {
    // Reads an external system (localStorage) not available during
    // SSR - see AppShell's auth-check effect for the same pattern.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
      setHiddenDatasets(getStoredTrendHidden());
    } catch {
      // ignore - see lib/api.ts's setToken for the same tradeoff
    }
  }, []);

  function load() {
    Promise.all([
      apiFetch<Summary>(`/api/summary?month=${monthStr}&trend_range=${trendRange}`),
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
  }, [monthStr, trendRange]);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  // Income/Expense/Net - kept as a bare count here since the legend
  // click handler only needs to know how many series exist, not their
  // colors/labels (those live inline in the chart's `datasets`
  // below). Matches TREND_SERIES's length in the Settings page,
  // which enforces the same "at least one visible" rule.
  const TREND_SERIES_COUNT = 3;

  function toggleTrendDataset(label: string) {
    setHiddenDatasets((prev) => {
      const isCurrentlyVisible = !prev.has(label);
      if (isCurrentlyVisible && TREND_SERIES_COUNT - prev.size <= 1) return prev;
      const next = new Set(prev);
      if (isCurrentlyVisible) next.add(label);
      else next.delete(label);
      setStoredTrendHidden(next);
      return next;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- only used by the Quick add form, commented out below
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

          {/* Net worth card - temporarily disabled, keep for later.
          <div className="glass-card mb-5 flex items-center justify-between rounded-2xl p-4">
            <span className="text-muted flex items-center gap-2 text-sm font-semibold">
              <AssetsIcon /> Net worth
            </span>
            <span className={`hideable-amount text-lg font-extrabold ${hidden ? "amount-hidden" : ""}`}>
              {money(summary.net_worth)}
            </span>
          </div>
          */}

          {/* Quick add form - temporarily disabled, keep for later.
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
          */}

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <div className="glass-card rounded-2xl p-5 lg:col-span-2">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">Analytics</h3>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {(() => {
                      const visible = (
                        [
                          ["Income", "#10b981", summary.mini_trend.map((m) => m.income)],
                          ["Expense", "#f43f5e", summary.mini_trend.map((m) => m.expense)],
                          ["Net", "#6366f1", summary.mini_trend.map((m) => m.net)],
                        ] as [string, string, number[]][]
                      ).filter(([label]) => !hiddenDatasets.has(label));
                      // With only one series showing, which one it is
                      // is already obvious (it's the only line/legend
                      // item left on the chart), so the label prefix
                      // is just noise.
                      const showLabel = visible.length > 1;
                      return visible.map(([label, color, values]) => {
                        const { high, avg } = seriesStats(values);
                        return (
                          <span key={label} className="text-faint text-xs">
                            {showLabel && (
                              <span className="font-semibold" style={{ color }}>
                                {label}{" "}
                              </span>
                            )}
                            High {money(high)} &middot; Avg {money(avg)}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
                <select
                  value={trendRange}
                  onChange={(e) => setTrendRange(e.target.value)}
                  className="input rounded-lg px-2 py-1 text-xs"
                >
                  {TREND_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <Line
                data={{
                  labels: summary.mini_trend.map((m) => m.month),
                  // Same accent colors as the KPI cards above
                  // (.kpi-income/.kpi-expense/.kpi-net in globals.css)
                  // so the chart reads as an extension of them, not a
                  // separate palette. Net is listed last so it draws
                  // on top of (and legends after) Income/Expense.
                  // cubicInterpolationMode: "monotone" instead of a
                  // fixed tension - a tension-based (Catmull-Rom)
                  // curve overshoots past flat/zero stretches of data
                  // to stay smooth everywhere, which reads as the line
                  // "curving" even where nothing changed. Monotone
                  // interpolation stays flat where the data is flat
                  // and only curves where there's an actual change.
                  // Filtered out entirely, not just marked `hidden` -
                  // Chart.js's default legend renders an entry (struck
                  // through) for every dataset regardless of `hidden`,
                  // which still reads as "3 series" even when only one
                  // line is actually drawn. Leaving a hidden series out
                  // of the array altogether means its legend entry
                  // disappears too; re-enabling it only through
                  // Settings/here (see toggleTrendDataset's min-1
                  // guard) is an acceptable tradeoff for that.
                  datasets: [
                    {
                      label: "Income",
                      data: summary.mini_trend.map((m) => m.income),
                      borderColor: "#10b981",
                      backgroundColor: "rgba(16, 185, 129, 0.08)",
                      fill: false,
                      cubicInterpolationMode: "monotone" as const,
                      pointRadius: 3,
                      pointBackgroundColor: "#10b981",
                    },
                    {
                      label: "Expense",
                      data: summary.mini_trend.map((m) => m.expense),
                      borderColor: "#f43f5e",
                      backgroundColor: "rgba(244, 63, 94, 0.08)",
                      fill: false,
                      cubicInterpolationMode: "monotone" as const,
                      pointRadius: 3,
                      pointBackgroundColor: "#f43f5e",
                    },
                    {
                      label: "Net",
                      data: summary.mini_trend.map((m) => m.net),
                      borderColor: "#6366f1",
                      backgroundColor: "rgba(99, 102, 241, 0.15)",
                      fill: true,
                      cubicInterpolationMode: "monotone" as const,
                      pointRadius: 3,
                      pointBackgroundColor: "#6366f1",
                    },
                  ].filter((d) => !hiddenDatasets.has(d.label)),
                }}
                options={{
                  layout: { padding: { top: 16 } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: "rgba(148,163,184,0.15)" } },
                  },
                  plugins: {
                    legend: {
                      display: true,
                      labels: { boxWidth: 10, usePointStyle: true },
                      // Persists which lines are toggled off to
                      // localStorage (via toggleTrendDataset), instead
                      // of only living in Chart.js's own in-memory
                      // legend state, which reset on every reload. The
                      // dataset array above is already filtered down
                      // to visible series, so clicking a legend entry
                      // only ever means "hide this one" - no
                      // chart.hide()/show() needed, React just
                      // re-renders with one fewer dataset (or refuses
                      // to, via toggleTrendDataset's min-1 guard).
                      onClick: (_e, legendItem) => {
                        if (legendItem.text) toggleTrendDataset(legendItem.text);
                      },
                    },
                  },
                }}
                // Only meaningful when looking at the actual current
                // month - Prev/Next now shifts every trend_range's
                // anchor to the navigated month server-side (see
                // month_anchor() in api.py), so a past/future month
                // has no "today" point to mark at all.
                plugins={isCurrentMonth ? [createTodayLinePlugin(getTodayIndexForRange(trendRange))] : []}
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
