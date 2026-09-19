"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Summary } from "@/types";

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Summary>("/api/summary/")
      .then(setSummary)
      .catch(() => setError("Couldn't load your summary"));
  }, []);

  return (
    <AppShell>
      <h2 className="mb-4 text-lg font-bold">
        {summary
          ? new Date(`${summary.month}-01`).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })
          : "Dashboard"}
      </h2>

      {error && <p className="text-neg text-sm">{error}</p>}

      {summary && (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="kpi-card kpi-income rounded-2xl p-4">
              <p className="kpi-label mb-1 text-xs font-semibold uppercase tracking-wider">Income</p>
              <p className="text-xl font-extrabold">{money(summary.income)}</p>
            </div>
            <div className="kpi-card kpi-expense rounded-2xl p-4">
              <p className="kpi-label mb-1 text-xs font-semibold uppercase tracking-wider">Expenses</p>
              <p className="text-xl font-extrabold">{money(summary.expense)}</p>
            </div>
            <div className="kpi-card kpi-net rounded-2xl p-4">
              <p className="kpi-label mb-1 text-xs font-semibold uppercase tracking-wider">Net</p>
              <p className="text-xl font-extrabold">{money(summary.net)}</p>
            </div>
          </div>

          <div className="glass-card flex items-center justify-between rounded-2xl p-4">
            <span className="text-muted flex items-center gap-2 text-sm font-semibold">💼 Net worth</span>
            <span className="text-lg font-extrabold">{money(summary.net_worth)}</span>
          </div>
        </>
      )}
    </AppShell>
  );
}
