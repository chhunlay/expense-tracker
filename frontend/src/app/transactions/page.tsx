"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch, apiDownload, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Modal from "@/components/Modal";
import { DownloadIcon, UploadIcon } from "@/components/icons";
import { Category, Transaction } from "@/types";

function money(value: string): string {
  return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm = () => ({
  type: "expense" as "expense" | "income",
  amount: "",
  categoryId: "",
  date: new Date().toISOString().slice(0, 10),
  note: "",
});

export default function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadData() {
    const params = new URLSearchParams();
    if (filterMonth) params.set("month", filterMonth);
    if (filterCategory) params.set("category_id", filterCategory);
    const qs = params.toString();
    Promise.all([
      apiFetch<Transaction[]>(`/api/transactions/${qs ? `?${qs}` : ""}`),
      apiFetch<Category[]>("/api/categories/"),
    ])
      .then(([txns, cats]) => {
        setRows(txns);
        setCategories(cats);
      })
      .catch(() => setError("Couldn't load transactions"));
  }

  useEffect(loadData, [filterMonth, filterCategory]);

  function openModal() {
    setForm({ ...emptyForm(), categoryId: categories[0] ? String(categories[0].id) : "" });
    setError(null);
    setModalOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch<Transaction>("/api/transactions/", {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          amount: form.amount,
          category: form.categoryId ? Number(form.categoryId) : null,
          date: form.date,
          note: form.note || null,
        }),
      });
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add transaction");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format: "csv" | "xlsx") {
    setExportMenuOpen(false);
    try {
      await apiDownload(`/api/export/${format}/`, `transactions.${format}`);
    } catch {
      setError("Couldn't export transactions");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiFetch<{ imported: number; skipped: number; created_categories: number }>(
        "/api/import/",
        { method: "POST", body: formData }
      );
      setImportMessage(
        `Imported ${result.imported} transaction(s), created ${result.created_categories} new categor(y/ies), skipped ${result.skipped} invalid row(s)`
      );
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't import file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Transactions</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              className="action-btn text-muted flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
            >
              <DownloadIcon /> Export
            </button>
            {exportMenuOpen && (
              <div className="glass-card absolute right-0 top-full z-10 mt-2 w-32 space-y-1 rounded-xl p-1.5">
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="nav-link block w-full rounded-lg px-3 py-2 text-left text-sm"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  className="nav-link block w-full rounded-lg px-3 py-2 text-left text-sm"
                >
                  XLSX
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="action-btn text-muted flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
          >
            <UploadIcon /> Import
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={handleImport} className="hidden" />
          <button
            type="button"
            onClick={openModal}
            className="action-btn rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
          >
            + Add
          </button>
        </div>
      </div>

      <Modal id="addModal" open={modalOpen} onClose={() => setModalOpen(false)} title="Add transaction">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="input flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 has-[:checked]:border-indigo-400">
                <input
                  type="radio"
                  checked={form.type === "expense"}
                  onChange={() => setForm({ ...form, type: "expense" })}
                  className="accent-indigo-500"
                />{" "}
                Expense
              </label>
              <label className="input flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 has-[:checked]:border-indigo-400">
                <input
                  type="radio"
                  checked={form.type === "income"}
                  onChange={() => setForm({ ...form, type: "income" })}
                  className="accent-indigo-500"
                />{" "}
                Income
              </label>
            </div>
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="What was it for?"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          {error && modalOpen && <p className="text-neg text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="action-btn text-muted flex-1 rounded-xl bg-white/10 py-3 font-semibold hover:bg-white/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="action-btn flex-1 rounded-xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      <div className="glass-card mb-4 flex flex-wrap gap-2 rounded-2xl p-4">
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="input rounded-xl px-3 py-2 text-sm"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(filterMonth || filterCategory) && (
          <button
            type="button"
            onClick={() => {
              setFilterMonth("");
              setFilterCategory("");
            }}
            className="action-btn text-muted rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Clear
          </button>
        )}
      </div>

      {importMessage && <p className="text-pos mb-3 text-sm">{importMessage}</p>}
      {error && !modalOpen && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {rows.length === 0 ? (
          <p className="text-faint text-sm">No transactions match this filter.</p>
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
