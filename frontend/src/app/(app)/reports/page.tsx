"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { ReportsData } from "@/types";

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ReportsData>("/api/reports")
      .then(setData)
      .catch(() => setError("Couldn't load reports"));
  }, []);

  return (
    <>
      <h2 className="mb-4 text-lg font-bold">{t("Reports")}</h2>
      {error && <p className="text-neg text-sm">{error}</p>}

      {data && (
        <>
          <div className="glass-card mb-5 rounded-2xl p-5">
            <h3 className="mb-3 font-bold">{t("Net trend (last 12 months)")}</h3>
            <div className="space-y-1.5">
              {data.monthly_totals.map((m) => (
                <div key={m.month} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{m.month}</span>
                  <span className="flex gap-4">
                    <span className="text-pos">+{money(m.income)}</span>
                    <span className="text-neg">-{money(m.expense)}</span>
                    <span className={`w-24 text-right font-semibold ${m.net >= 0 ? "text-pos" : "text-neg"}`}>
                      {money(m.net)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 font-bold">{t("Top categories (last 12 months)")}</h3>
            {data.top_categories.length === 0 ? (
              <p className="text-faint text-sm">{t("No expenses in this window yet.")}</p>
            ) : (
              <div className="space-y-2">
                {data.top_categories.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="text-muted font-medium">{money(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
