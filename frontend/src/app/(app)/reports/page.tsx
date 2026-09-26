"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";

import { apiFetch } from "@/lib/api";
import { CategoryIcon } from "@/lib/categoryIcons";
import { useTranslation } from "@/lib/i18n";
import { ReportsData } from "@/types";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

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

  const totals = data?.monthly_totals.reduce(
    (acc, m) => ({ income: acc.income + m.income, expense: acc.expense + m.expense, net: acc.net + m.net }),
    { income: 0, expense: 0, net: 0 }
  );

  return (
    <>
      <h2 className="mb-4 text-lg font-bold">{t("Reports")}</h2>
      {error && <p className="text-neg text-sm">{error}</p>}

      {data && (
        <>
          {totals && (
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="glass-card rounded-2xl p-4">
                <p className="text-muted text-xs font-semibold uppercase tracking-wider">{t("Income")}</p>
                <p className="text-pos mt-1 text-xl font-bold">{money(totals.income)}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-muted text-xs font-semibold uppercase tracking-wider">{t("Expense")}</p>
                <p className="text-neg mt-1 text-xl font-bold">{money(totals.expense)}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-muted text-xs font-semibold uppercase tracking-wider">Net</p>
                <p className={`mt-1 text-xl font-bold ${totals.net >= 0 ? "text-pos" : "text-neg"}`}>
                  {money(totals.net)}
                </p>
              </div>
            </div>
          )}

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <div className="glass-card rounded-2xl p-5 lg:col-span-2">
              <h3 className="mb-3 font-bold">{t("Net trend (last 12 months)")}</h3>
              <Bar
                data={{
                  labels: data.monthly_totals.map((m) => m.month),
                  datasets: [
                    {
                      label: t("Income"),
                      data: data.monthly_totals.map((m) => m.income),
                      backgroundColor: "#10b981",
                      borderRadius: 4,
                    },
                    {
                      label: t("Expense"),
                      data: data.monthly_totals.map((m) => m.expense),
                      backgroundColor: "#f43f5e",
                      borderRadius: 4,
                    },
                  ],
                }}
                options={{
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: "rgba(148,163,184,0.15)" } },
                  },
                  plugins: { legend: { position: "top", labels: { boxWidth: 10, boxHeight: 10 } } },
                }}
                height={220}
              />
            </div>

            <div className="glass-card rounded-2xl p-5">
              <h3 className="mb-3 font-bold">{t("Top categories (last 12 months)")}</h3>
              {data.top_categories.length === 0 ? (
                <p className="text-faint text-sm">{t("No expenses in this window yet.")}</p>
              ) : (
                <>
                  <Doughnut
                    data={{
                      labels: data.top_categories.map((c) => c.name),
                      datasets: [
                        {
                          data: data.top_categories.map((c) => c.total),
                          backgroundColor: data.top_categories.map((c) => c.color),
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{ plugins: { legend: { display: false } }, cutout: "65%" }}
                    height={160}
                  />
                  <div className="mt-3 space-y-1.5">
                    {data.top_categories.map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <CategoryIcon icon={c.icon} width={15} height={15} className="flex-shrink-0" style={{ color: c.color }} />
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="text-muted ml-2 flex-shrink-0">{money(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
