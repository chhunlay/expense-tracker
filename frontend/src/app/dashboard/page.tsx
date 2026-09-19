"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import { Summary } from "@/types";

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DashboardContent() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Summary>("/api/summary/")
      .then(setSummary)
      .catch(() => setError("Couldn't load your summary"));
  }, []);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">
          {summary
            ? new Date(`${summary.month}-01`).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })
            : "Dashboard"}
        </h2>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        {summary && (
          <>
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-4 text-white shadow-lg">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">Income</p>
                <p className="text-xl font-extrabold">{money(summary.income)}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 p-4 text-white shadow-lg">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">Expenses</p>
                <p className="text-xl font-extrabold">{money(summary.expense)}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 p-4 text-white shadow-lg">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">Net</p>
                <p className="text-xl font-extrabold">{money(summary.net)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                💼 Net worth
              </span>
              <span className="text-lg font-extrabold">{money(summary.net_worth)}</span>
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
