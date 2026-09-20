"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch, apiDownload, ApiError } from "@/lib/api";
import Modal from "@/components/Modal";
import { DownloadIcon, EditIcon, UploadIcon } from "@/components/icons";
import { useTranslation } from "@/lib/i18n";
import { Category, Transaction } from "@/types";

function money(value: string): string {
  return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A "Categories" filter button that opens a checklist of every
 * category on click - unlike ColorPicker's palette, selecting one item
 * shouldn't close this, since picking several is the whole point.
 * Closes on an outside click instead of mouse-leave: hover-to-close
 * doesn't hold up here because selecting a category can insert the
 * neighboring "Clear" button into this flex-wrap row, which reflows
 * this dropdown right out from under a stationary pointer - Chrome
 * then reports that as a real mouseleave. Click-away has no such
 * dependency on layout staying put. */
function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

function CategoryFilter({
  categories,
  selected,
  onChange,
  t,
}: {
  categories: Category[];
  selected: Set<number>;
  onChange: (ids: Set<number>) => void;
  t: (text: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  const label =
    selected.size === 0
      ? t("All categories")
      : selected.size === 1
        ? categories.find((c) => selected.has(c.id))?.name || t("All categories")
        : `${selected.size} categories`;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input rounded-xl px-3 py-2 text-left text-sm"
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 pt-1.5">
          <div className="glass-card w-56 rounded-xl p-2 shadow-lg">
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {categories.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="accent-indigo-500 h-3.5 w-3.5 flex-shrink-0"
                  />
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </label>
              ))}
            </div>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-muted mt-1 w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-white/5"
              >
                {t("Clear")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const emptyForm = () => ({
  type: "expense" as "expense" | "income",
  amount: "",
  categoryId: "",
  date: new Date().toISOString().slice(0, 10),
  note: "",
});

export default function TransactionsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategoryIds, setFilterCategoryIds] = useState<Set<number>>(new Set());
  const [minAmountInput, setMinAmountInput] = useState("");
  const [maxAmountInput, setMaxAmountInput] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce the amount-range inputs so typing a number doesn't fire a
  // request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setMinAmount(minAmountInput), 400);
    return () => clearTimeout(timer);
  }, [minAmountInput]);
  useEffect(() => {
    const timer = setTimeout(() => setMaxAmount(maxAmountInput), 400);
    return () => clearTimeout(timer);
  }, [maxAmountInput]);

  const filterCategoryIdsKey = Array.from(filterCategoryIds).sort().join(",");

  function loadData() {
    const params = new URLSearchParams();
    if (filterMonth) params.set("month", filterMonth);
    if (filterCategoryIdsKey) params.set("category_ids", filterCategoryIdsKey);
    if (minAmount) params.set("min_amount", minAmount);
    if (maxAmount) params.set("max_amount", maxAmount);
    const qs = params.toString();
    Promise.all([
      apiFetch<Transaction[]>(`/api/transactions${qs ? `?${qs}` : ""}`),
      apiFetch<Category[]>("/api/categories"),
    ])
      .then(([txns, cats]) => {
        setRows(txns);
        setCategories(cats);
      })
      .catch(() => setError("Couldn't load transactions"));
  }

  useEffect(loadData, [filterMonth, filterCategoryIdsKey, minAmount, maxAmount]);

  function openAddModal() {
    setEditingId(null);
    setForm({ ...emptyForm(), categoryId: categories[0] ? String(categories[0].id) : "" });
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(r: Transaction) {
    setEditingId(r.id);
    setForm({
      type: r.type,
      amount: r.amount,
      categoryId: r.category ? String(r.category) : "",
      date: r.date,
      note: r.note || "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = JSON.stringify({
        type: form.type,
        amount: form.amount,
        category: form.categoryId ? Number(form.categoryId) : null,
        date: form.date,
        note: form.note || null,
      });
      if (editingId) {
        await apiFetch<Transaction>(`/api/transactions/${editingId}`, { method: "PATCH", body });
      } else {
        await apiFetch<Transaction>("/api/transactions", { method: "POST", body });
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save transaction");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm(t("Delete this transaction?"))) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/transactions/${editingId}`, { method: "DELETE" });
      setModalOpen(false);
      loadData();
    } catch {
      setError("Couldn't delete transaction");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(format: "csv" | "xlsx") {
    setExportMenuOpen(false);
    try {
      await apiDownload(`/api/export/${format}`, `transactions.${format}`);
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
        "/api/import",
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
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Transactions</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              className="action-btn text-muted flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
            >
              <DownloadIcon /> {t("Export")}
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
            <UploadIcon /> {t("Import")}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={handleImport} className="hidden" />
          <button
            type="button"
            onClick={openAddModal}
            className="action-btn rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
          >
            + {t("Add")}
          </button>
        </div>
      </div>

      <Modal
        id="addModal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t("Edit transaction") : t("Add transaction")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
                {t("Expense")}
              </label>
              <label className="input flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 has-[:checked]:border-indigo-400">
                <input
                  type="radio"
                  checked={form.type === "income"}
                  onChange={() => setForm({ ...form, type: "income" })}
                  className="accent-indigo-500"
                />{" "}
                {t("Income")}
              </label>
            </div>
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Amount")}
            </label>
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
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Category")}
            </label>
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
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">{t("Date")}</label>
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
              {t("Note (optional)")}
            </label>
            <input
              type="text"
              placeholder={t("What was it for?")}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          {error && modalOpen && <p className="text-neg text-sm">{error}</p>}
          <div className="flex gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="action-btn text-neg rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-rose-500/20 disabled:opacity-60"
              >
                {t("Delete")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="action-btn text-muted flex-1 rounded-xl bg-white/10 py-3 font-semibold hover:bg-white/15"
              >
                {t("Cancel")}
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="action-btn flex-1 rounded-xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
            >
              {t("Save")}
            </button>
          </div>
        </form>
      </Modal>

      {/* relative z-10: .glass-card's backdrop-filter makes this its own
          stacking context, which would otherwise trap the category
          dropdown's z-20 below the transactions table card that follows
          it in the DOM - lifting the whole filter row above it here is
          what actually lets the dropdown paint on top. */}
      <div className="glass-card relative z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-4">
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="input rounded-xl px-3 py-2 text-sm"
        />
        <CategoryFilter categories={categories} selected={filterCategoryIds} onChange={setFilterCategoryIds} t={t} />
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={t("Min")}
            value={minAmountInput}
            onChange={(e) => setMinAmountInput(e.target.value)}
            className="input w-24 rounded-xl px-3 py-2 text-sm"
          />
          <span className="text-muted text-sm">–</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={t("Max")}
            value={maxAmountInput}
            onChange={(e) => setMaxAmountInput(e.target.value)}
            className="input w-24 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        {(filterMonth || filterCategoryIds.size > 0 || minAmountInput || maxAmountInput) && (
          <button
            type="button"
            onClick={() => {
              setFilterMonth("");
              setFilterCategoryIds(new Set());
              setMinAmountInput("");
              setMaxAmountInput("");
            }}
            className="action-btn text-muted rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            {t("Clear")}
          </button>
        )}
      </div>

      {importMessage && <p className="text-pos mb-3 text-sm">{importMessage}</p>}
      {error && !modalOpen && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {rows.length === 0 ? (
          <p className="text-faint text-sm">{t("No transactions match this filter.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="txn-table w-full text-left text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-3">{t("Date")}</th>
                  <th className="pb-2 pr-3">{t("Category")}</th>
                  <th className="pb-2 pr-3">{t("Note")}</th>
                  <th className="pb-2 pr-3 text-right">{t("Amount")}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap py-2 pr-3">{r.date}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: r.category_color || "#94a3b8" }}
                        />
                        {r.category_name || t("Uncategorized")}
                      </span>
                    </td>
                    <td className="text-muted py-2 pr-3">{r.note || ""}</td>
                    <td
                      className={`whitespace-nowrap py-2 pr-3 text-right font-semibold ${
                        r.type === "income" ? "text-pos" : "text-neg"
                      }`}
                    >
                      {r.type === "income" ? "+" : "-"}
                      {money(r.amount)}
                    </td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(r)}
                        aria-label={t("Edit transaction")}
                        title="Edit"
                        className="text-muted inline-flex rounded-lg p-1.5 transition-colors hover:bg-indigo-500/15 hover:text-indigo-400"
                      >
                        <EditIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
