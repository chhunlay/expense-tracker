"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import { ReportsData } from "@/types";

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReportsContent() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ReportsData>("/api/reports/")
      .then(setData)
      .catch(() => setError("Couldn't load reports"));
  }, []);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Reports</h2>
        {error && <p className="text-sm text-rose-400">{error}</p>}

        {data && (
          <>
            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="mb-3 font-bold">Net trend (last 12 months)</h3>
              <div className="space-y-1.5">
                {data.monthly_totals.map((m) => (
                  <div key={m.month} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{m.month}</span>
                    <span className="flex gap-4">
                      <span className="text-emerald-400">+{money(m.income)}</span>
                      <span className="text-rose-400">-{money(m.expense)}</span>
                      <span className={`w-24 text-right font-semibold ${m.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {money(m.net)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="mb-3 font-bold">Top categories (last 12 months)</h3>
              {data.top_categories.length === 0 ? (
                <p className="text-sm text-slate-400">No expenses in this window yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.top_categories.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="font-medium text-slate-400">{money(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <ReportsContent />
    </RequireAuth>
  );
}
