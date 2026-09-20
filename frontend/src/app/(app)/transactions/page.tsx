"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { apiFetch, apiDownload, ApiError } from "@/lib/api";
import Modal from "@/components/Modal";
import {
  CalendarIcon,
  CategoriesIcon,
  ChevronIcon,
  DownloadIcon,
  EditIcon,
  FilterIcon,
  GroupIcon,
  SearchIcon,
  StarIcon,
  UploadIcon,
} from "@/components/icons";
import { useTranslation } from "@/lib/i18n";
import { Category, SavedSearch, Transaction } from "@/types";

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

export type GroupBy = "" | "category" | "type" | "month";

const GROUP_OPTIONS: { value: Exclude<GroupBy, "">; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "type", label: "Type" },
  { value: "month", label: "Month" },
];

export interface DateOption {
  label: string;
  month?: string;
  from?: string;
  to?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The current month plus the two before it, then this year's four
 * quarters (most recent first) - the same relative, always-fresh
 * options Odoo's own "Date" filter group offers, recomputed from
 * today's date rather than stored anywhere. */
function getDateOptions(): DateOption[] {
  const now = new Date();
  const months: DateOption[] = [0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return { label: d.toLocaleString("default", { month: "long" }), month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}` };
  });
  const quarters: DateOption[] = [4, 3, 2, 1].map((q) => {
    const startMonth = (q - 1) * 3;
    const from = new Date(now.getFullYear(), startMonth, 1);
    const to = new Date(now.getFullYear(), startMonth + 3, 0);
    return { label: `Q${q}`, from: isoDate(from), to: isoDate(to) };
  });
  return [...months, ...quarters];
}

function sameDateOption(a: DateOption | null, b: DateOption): boolean {
  return !!a && a.label === b.label && a.month === b.month && a.from === b.from && a.to === b.to;
}

/** A collapsed-by-default group within the Filters column (Categories,
 * Date) - starts open only when it already has an active selection
 * (e.g. applying a favorite), otherwise stays out of the way until
 * clicked open. */
function CollapsibleSection({
  label,
  icon,
  startOpen,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  startOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="border-t border-[var(--card-border)] pt-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-muted flex w-full items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-white/5"
      >
        <span className="flex items-center gap-1.5">
          {icon} {label}
        </span>
        <ChevronIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

/** The Filter button's dropdown - an Odoo-style search panel with
 * three columns: Filters (the existing month/category filters),
 * Group By (how the table below is bucketed), and Favorites (named
 * combinations of the two, saved server-side so they follow the user
 * across devices; one can be marked default to auto-apply on load). */
function FilterPanel({
  categories,
  filterCategoryIds,
  onFilterCategoryIdsChange,
  dateFilter,
  onDateFilterChange,
  groupBy,
  onGroupByChange,
  savedSearches,
  onApplySavedSearch,
  onSaveCurrentSearch,
  onToggleDefault,
  onDeleteSavedSearch,
  t,
}: {
  categories: Category[];
  filterCategoryIds: Set<number>;
  onFilterCategoryIdsChange: (ids: Set<number>) => void;
  dateFilter: DateOption | null;
  onDateFilterChange: (date: DateOption | null) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  savedSearches: SavedSearch[];
  onApplySavedSearch: (search: SavedSearch) => void;
  onSaveCurrentSearch: (name: string, isDefault: boolean) => void;
  onToggleDefault: (search: SavedSearch) => void;
  onDeleteSavedSearch: (search: SavedSearch) => void;
  t: (text: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  function toggleCategory(id: number) {
    const next = new Set(filterCategoryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onFilterCategoryIdsChange(next);
  }

  const dateOptions = getDateOptions();
  const activeCount = filterCategoryIds.size + (dateFilter ? 1 : 0) + (groupBy ? 1 : 0);

  return (
    <div ref={ref} className="relative inline-block flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={activeCount === 0 ? t("Filter") : `${t("Filter")} (${activeCount})`}
        title={t("Filter")}
        className="text-muted flex items-center rounded-lg bg-[var(--track-bg)] p-1 transition-colors hover:bg-[var(--accent)]/15 hover:text-[var(--accent)]"
      >
        <FilterIcon className="h-3.5 w-3.5 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 pt-1.5">
          <div className="glass-card grid w-[min(640px,90vw)] grid-cols-1 gap-4 rounded-xl p-4 shadow-lg sm:grid-cols-3">
            <div>
              <h4 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <FilterIcon className="h-3 w-3" /> {t("Filters")}
              </h4>

              <CollapsibleSection
                label={t("Categories")}
                icon={<CategoriesIcon className="h-3.5 w-3.5" />}
                startOpen={filterCategoryIds.size > 0}
              >
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  {categories.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={filterCategoryIds.has(c.id)}
                        onChange={() => toggleCategory(c.id)}
                        className="accent-[var(--accent)] h-3.5 w-3.5 flex-shrink-0"
                      />
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </label>
                  ))}
                </div>
                {filterCategoryIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => onFilterCategoryIdsChange(new Set())}
                    className="text-muted mt-1 w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-white/5"
                  >
                    {t("Clear")}
                  </button>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                label={t("Date")}
                icon={<CalendarIcon className="h-3.5 w-3.5" />}
                startOpen={dateFilter !== null}
              >
                <div className="space-y-0.5">
                  {dateOptions.map((opt) => {
                    const active = sameDateOption(dateFilter, opt);
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => onDateFilterChange(active ? null : opt)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                      >
                        <span
                          className={`h-3.5 w-3.5 flex-shrink-0 rounded border ${
                            active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--input-border)]"
                          }`}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </div>

            <div>
              <h4 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <GroupIcon className="h-3 w-3" /> {t("Group By")}
              </h4>
              <div className="space-y-0.5">
                {GROUP_OPTIONS.map((opt) => {
                  const active = groupBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onGroupByChange(active ? "" : opt.value)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    >
                      <span
                        className={`h-3.5 w-3.5 flex-shrink-0 rounded border ${
                          active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--input-border)]"
                        }`}
                      />
                      {t(opt.label)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <StarIcon filled className="h-3 w-3" /> {t("Favorites")}
              </h4>
              <div className="max-h-32 space-y-0.5 overflow-y-auto">
                {savedSearches.length === 0 && <p className="text-faint px-2 text-xs">{t("No saved searches yet.")}</p>}
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    className="group/fav flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
                  >
                    <button type="button" onClick={() => onApplySavedSearch(s)} className="flex-1 truncate text-left">
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleDefault(s)}
                      aria-label={s.is_default ? t("Unset as default") : t("Set as default")}
                      title={t("Default")}
                      className={s.is_default ? "text-amber-400" : "text-faint opacity-0 hover:text-amber-400 group-hover/fav:opacity-100"}
                    >
                      <StarIcon filled={s.is_default} className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedSearch(s)}
                      aria-label={t("Delete")}
                      className="text-faint opacity-0 hover:text-rose-400 group-hover/fav:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={t("Save current search")}
                  className="input min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={!saveName.trim()}
                  onClick={() => {
                    onSaveCurrentSearch(saveName.trim(), saveAsDefault);
                    setSaveName("");
                    setSaveAsDefault(false);
                  }}
                  className="rounded-lg bg-indigo-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
                >
                  {t("Save")}
                </button>
              </div>
              <label className="text-muted mt-1.5 flex cursor-pointer items-center gap-1.5 px-2 text-xs">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  className="accent-indigo-500 h-3 w-3 flex-shrink-0"
                />
                {t("Use as default on load")}
              </label>
            </div>
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

  const [filterCategoryIds, setFilterCategoryIds] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateOption | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("");
  const [amountSort, setAmountSort] = useState<"asc" | "desc" | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedDefaultSearch = useRef(false);

  const filterCategoryIdsKey = Array.from(filterCategoryIds).sort().join(",");

  function loadData() {
    const params = new URLSearchParams();
    if (filterCategoryIdsKey) params.set("category_ids", filterCategoryIdsKey);
    if (dateFilter?.month) params.set("month", dateFilter.month);
    else if (dateFilter?.from || dateFilter?.to) {
      if (dateFilter.from) params.set("date_from", dateFilter.from);
      if (dateFilter.to) params.set("date_to", dateFilter.to);
    }
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

  useEffect(loadData, [filterCategoryIdsKey, dateFilter]);

  function applySavedSearch(search: SavedSearch) {
    setFilterCategoryIds(
      new Set(
        search.category_ids
          .split(",")
          .filter(Boolean)
          .map((id) => Number(id))
      )
    );
    if (search.month) setDateFilter(getDateOptions().find((o) => o.month === search.month) ?? { label: search.month, month: search.month });
    else if (search.date_from || search.date_to) {
      const match = getDateOptions().find((o) => o.from === search.date_from && o.to === search.date_to);
      setDateFilter(match ?? { label: t("Custom range"), from: search.date_from, to: search.date_to });
    } else {
      setDateFilter(null);
    }
    setGroupBy((search.group_by || "") as GroupBy);
  }

  function loadSavedSearches() {
    apiFetch<SavedSearch[]>("/api/saved-searches?page=transactions")
      .then((searches) => {
        setSavedSearches(searches);
        if (!appliedDefaultSearch.current) {
          appliedDefaultSearch.current = true;
          const defaultSearch = searches.find((s) => s.is_default);
          if (defaultSearch) applySavedSearch(defaultSearch);
        }
      })
      .catch(() => {
        // Not worth surfacing an error banner for - Favorites just
        // starts empty and the rest of the page still works fine.
      });
  }

  // Runs once on mount only, to auto-apply whichever saved search is
  // marked default - re-running it on every applySavedSearch identity
  // change (a new closure every render) would refetch on every filter
  // tweak instead of just once at load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadSavedSearches, []);

  async function handleSaveCurrentSearch(name: string, isDefault: boolean) {
    try {
      const saved = await apiFetch<SavedSearch>("/api/saved-searches", {
        method: "POST",
        body: JSON.stringify({
          page: "transactions",
          name,
          category_ids: filterCategoryIdsKey,
          month: dateFilter?.month ?? "",
          date_from: dateFilter?.from ?? "",
          date_to: dateFilter?.to ?? "",
          group_by: groupBy,
          is_default: isDefault,
        }),
      });
      setSavedSearches((prev) =>
        [...prev.map((s) => (isDefault ? { ...s, is_default: false } : s)), saved].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    } catch {
      setError("Couldn't save this search");
    }
  }

  async function handleToggleDefault(search: SavedSearch) {
    try {
      const updated = await apiFetch<SavedSearch>(`/api/saved-searches/${search.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_default: !search.is_default }),
      });
      setSavedSearches((prev) => prev.map((s) => (s.id === updated.id ? updated : { ...s, is_default: false })));
    } catch {
      setError("Couldn't update this search");
    }
  }

  async function handleDeleteSavedSearch(search: SavedSearch) {
    try {
      await apiFetch(`/api/saved-searches/${search.id}`, { method: "DELETE" });
      setSavedSearches((prev) => prev.filter((s) => s.id !== search.id));
    } catch {
      setError("Couldn't delete this search");
    }
  }

  function toggleAmountSort() {
    setAmountSort((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null));
  }

  const searchedRows = searchQuery.trim()
    ? rows.filter((r) => r.note?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : rows;

  const sortedRows =
    amountSort === null
      ? searchedRows
      : [...searchedRows].sort((a, b) => {
          const signedA = parseFloat(a.amount) * (a.type === "income" ? 1 : -1);
          const signedB = parseFloat(b.amount) * (b.type === "income" ? 1 : -1);
          return amountSort === "asc" ? signedA - signedB : signedB - signedA;
        });

  const groups =
    groupBy === ""
      ? null
      : (() => {
          const map = new Map<string, Transaction[]>();
          for (const r of sortedRows) {
            const key =
              groupBy === "category"
                ? r.category_name || t("Uncategorized")
                : groupBy === "type"
                  ? r.type === "income"
                    ? t("Income")
                    : t("Expense")
                  : r.date.slice(0, 7);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
          }
          return Array.from(map.entries()).map(([label, groupRows]) => ({
            label,
            rows: groupRows,
            total: groupRows.reduce((sum, r) => sum + parseFloat(r.amount) * (r.type === "income" ? 1 : -1), 0),
          }));
        })();

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

  function renderRow(r: Transaction) {
    return (
      <tr key={r.id}>
        <td className="whitespace-nowrap py-2 pr-3">{r.date}</td>
        <td className="py-2 pr-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: r.category_color || "#94a3b8" }} />
            {r.category_name || t("Uncategorized")}
          </span>
        </td>
        <td className="text-muted py-2 pr-3">{r.note || ""}</td>
        <td
          className={`whitespace-nowrap py-2 pr-3 text-right font-semibold ${r.type === "income" ? "text-pos" : "text-neg"}`}
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
    );
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm">
          <SearchIcon className="text-faint h-3.5 w-3.5 flex-shrink-0" />
          {filterCategoryIds.size > 0 && (
            <span className="text-muted flex items-center gap-1.5 rounded-lg bg-[var(--track-bg)] px-2 py-1 text-xs font-semibold">
              <FilterIcon className="h-3 w-3 flex-shrink-0" />
              {categories
                .filter((c) => filterCategoryIds.has(c.id))
                .map((c) => c.name)
                .join(" or ")}
              <button
                type="button"
                onClick={() => setFilterCategoryIds(new Set())}
                aria-label={t("Clear")}
                className="hover:text-main"
              >
                ✕
              </button>
            </span>
          )}
          {dateFilter && (
            <span className="text-muted flex items-center gap-1.5 rounded-lg bg-[var(--track-bg)] px-2 py-1 text-xs font-semibold">
              <CalendarIcon className="h-3 w-3 flex-shrink-0" />
              {dateFilter.label}
              <button
                type="button"
                onClick={() => setDateFilter(null)}
                aria-label={t("Clear")}
                className="hover:text-main"
              >
                ✕
              </button>
            </span>
          )}
          {groupBy && (
            <span className="text-muted flex items-center gap-1.5 rounded-lg bg-[var(--track-bg)] px-2 py-1 text-xs font-semibold">
              <GroupIcon className="h-3 w-3 flex-shrink-0" />
              {t(GROUP_OPTIONS.find((opt) => opt.value === groupBy)?.label ?? "")}
              <button
                type="button"
                onClick={() => setGroupBy("")}
                aria-label={t("Clear")}
                className="hover:text-main"
              >
                ✕
              </button>
            </span>
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Backspace" && e.key !== "Delete") return;
              if (searchQuery) return;
              // Same "backspace clears the last chip" convention as
              // Gmail's To field - only kicks in once the text itself
              // is already empty, so it never eats a keystroke while
              // typing.
              if (groupBy) setGroupBy("");
              else if (dateFilter) setDateFilter(null);
              else if (filterCategoryIds.size > 0) setFilterCategoryIds(new Set());
            }}
            placeholder={t("Search notes...")}
            className="min-w-[80px] flex-1 bg-transparent outline-none"
          />
          <FilterPanel
            categories={categories}
            filterCategoryIds={filterCategoryIds}
            onFilterCategoryIdsChange={setFilterCategoryIds}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            savedSearches={savedSearches}
            onApplySavedSearch={applySavedSearch}
            onSaveCurrentSearch={handleSaveCurrentSearch}
            onToggleDefault={handleToggleDefault}
            onDeleteSavedSearch={handleDeleteSavedSearch}
            t={t}
          />
        </div>
      </div>

      {importMessage && <p className="text-pos mb-3 text-sm">{importMessage}</p>}
      {error && !modalOpen && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {searchedRows.length === 0 ? (
          <p className="text-faint text-sm">{t("No transactions match this filter.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="txn-table w-full text-left text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-3">{t("Date")}</th>
                  <th className="pb-2 pr-3">{t("Category")}</th>
                  <th className="pb-2 pr-3">{t("Note")}</th>
                  <th className="pb-2 pr-3 text-right">
                    <button
                      type="button"
                      onClick={toggleAmountSort}
                      className="group hover:text-main inline-flex items-center gap-1 uppercase tracking-wider"
                    >
                      {t("Amount")}
                      <span className="w-3 text-left">
                        {amountSort === "asc" ? (
                          "↑"
                        ) : amountSort === "desc" ? (
                          "↓"
                        ) : (
                          <span className="opacity-0 group-hover:opacity-50">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {groups
                  ? groups.map((g) => (
                      <Fragment key={g.label}>
                        <tr className="bg-white/[0.03]">
                          <td colSpan={3} className="py-1.5 pr-3 text-xs font-bold uppercase tracking-wider">
                            {g.label}
                          </td>
                          <td
                            className={`whitespace-nowrap py-1.5 pr-3 text-right text-xs font-bold ${g.total >= 0 ? "text-pos" : "text-neg"}`}
                          >
                            {g.total >= 0 ? "+" : "-"}
                            {money(String(Math.abs(g.total)))}
                          </td>
                          <td></td>
                        </tr>
                        {g.rows.map(renderRow)}
                      </Fragment>
                    ))
                  : sortedRows.map(renderRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
