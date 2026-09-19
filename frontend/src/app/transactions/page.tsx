"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Category, Transaction } from "@/types";

function money(value: string): string {
  return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function loadData() {
    Promise.all([
      apiFetch<Transaction[]>("/api/transactions/"),
      apiFetch<Category[]>("/api/categories/"),
    ])
      .then(([txns, cats]) => {
        setRows(txns);
        setCategories(cats);
        if (cats.length && !categoryId) setCategoryId(String(cats[0].id));
      })
      .catch(() => setError("Couldn't load transactions"));
  }

  useEffect(loadData, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch<Transaction>("/api/transactions/", {
        method: "POST",
        body: JSON.stringify({
          type,
          amount,
          category: categoryId ? Number(categoryId) : null,
          date: txnDate,
          note: note || null,
        }),
      });
      setAmount("");
      setNote("");
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h2 className="mb-4 text-lg font-bold">Transactions</h2>

      <form onSubmit={handleAdd} className="glass-card mb-5 grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-5">
        <select value={type} onChange={(e) => setType(e.target.value as "expense" | "income")} className="input rounded-xl px-3 py-2 text-sm">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input rounded-xl px-3 py-2 text-sm"
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input rounded-xl px-3 py-2 text-sm">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          required
          value={txnDate}
          onChange={(e) => setTxnDate(e.target.value)}
          className="input rounded-xl px-3 py-2 text-sm"
        />
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <input
            type="text"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input flex-1 rounded-xl px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="action-btn rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </form>

      {error && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {rows.length === 0 ? (
          <p className="text-faint text-sm">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="txn-table w-full text-left text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Note</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap py-2 pr-3">{r.date}</td>
                    <td className="py-2 pr-3">{r.category_name || "Uncategorized"}</td>
                    <td className="text-muted py-2 pr-3">{r.note || ""}</td>
                    <td
                      className={`whitespace-nowrap py-2 pr-3 text-right font-semibold ${
                        r.type === "income" ? "text-pos" : "text-neg"
                      }`}
                    >
                      {r.type === "income" ? "+" : "-"}
                      {money(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
