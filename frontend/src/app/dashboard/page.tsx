"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Summary, Transaction } from "@/types";

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummary(null);
    Promise.all([
      apiFetch<Summary>(`/api/summary?month=${monthStr}`),
      apiFetch<Transaction[]>(`/api/transactions?month=${monthStr}&limit=8`),
    ])
      .then(([s, txns]) => {
        setSummary(s);
        setRecent(txns);
      })
      .catch(() => setError("Couldn't load your summary"));
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
            <span className="text-muted flex items-center gap-2 text-sm font-semibold">💼 Net worth</span>
            <span className={`hideable-amount text-lg font-extrabold ${hidden ? "amount-hidden" : ""}`}>
              {money(summary.net_worth)}
            </span>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 font-bold">Recent</h3>
            {recent.length === 0 ? (
              <p className="text-faint text-sm">Nothing logged this month yet.</p>
            ) : (
              <div className="space-y-2">
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{r.note || r.category_name || "Uncategorized"}</p>
                      <p className="text-faint text-xs">
                        {r.date} &middot; {r.category_name || "Uncategorized"}
                      </p>
                    </div>
                    <span className={`ml-2 flex-shrink-0 font-semibold ${r.type === "income" ? "text-pos" : "text-neg"}`}>
                      {r.type === "income" ? "+" : "-"}$
                      {parseFloat(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
