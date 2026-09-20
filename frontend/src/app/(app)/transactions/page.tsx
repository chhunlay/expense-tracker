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

export type GroupField = "category" | "type" | "month";
type SortColumn = "date" | "category" | "note" | "amount" | null;

const DEFAULT_PAGE_SIZE = 40;

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "type", label: "Type" },
  { value: "month", label: "Month" },
];

interface GroupNode {
  label: string;
  path: string;
  rows: Transaction[];
  total: number;
  children: GroupNode[] | null;
}

function groupKeyFor(r: Transaction, field: GroupField, t: (text: string) => string): string {
  switch (field) {
    case "category":
      return r.category_name || t("Uncategorized");
    case "type":
      return r.type === "income" ? t("Income") : t("Expense");
    case "month":
      return r.date.slice(0, 7);
  }
}

/** Builds one level of groups, then recurses into the remaining fields
 * for each group's rows - "Type -> Category" nests every Category
 * group inside its Type group, rather than flattening both into one
 * level. `path` threads the full chain of labels down to each node
 * (e.g. "Expense>Food & Dining") so fold state and React keys stay
 * unique across sibling branches that happen to share a label. */
function buildGroups(rows: Transaction[], fields: GroupField[], t: (text: string) => string, parentPath = ""): GroupNode[] {
  if (fields.length === 0) return [];
  const [field, ...rest] = fields;
  const map = new Map<string, Transaction[]>();
  for (const r of rows) {
    const key = groupKeyFor(r, field, t);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([label, groupRows]) => {
    const path = parentPath ? `${parentPath}>${label}` : label;
    return {
      label,
      path,
      rows: groupRows,
      total: groupRows.reduce((sum, r) => sum + parseFloat(r.amount) * (r.type === "income" ? 1 : -1), 0),
      children: rest.length > 0 ? buildGroups(groupRows, rest, t, path) : null,
    };
  });
}

function collectGroupPaths(nodes: GroupNode[]): string[] {
  return nodes.flatMap((n) => [n.path, ...(n.children ? collectGroupPaths(n.children) : [])]);
}

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

/** This Week/This Month/Last Month - quick one-click shortcuts shown
 * above the full Date list rather than folded inside it, since they're
 * the ranges people reach for most often. */
function getQuickDateOptions(): DateOption[] {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [
    { label: "This Week", from: isoDate(monday), to: isoDate(sunday) },
    { label: "This Month", month: `${thisMonth.getFullYear()}-${pad(thisMonth.getMonth() + 1)}` },
    { label: "Last Month", month: `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}` },
  ];
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
  groupByFields,
  onToggleGroupField,
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
  groupByFields: GroupField[];
  onToggleGroupField: (field: GroupField) => void;
  savedSearches: SavedSearch[];
  onApplySavedSearch: (search: SavedSearch) => void;
  onSaveCurrentSearch: (name: string, isDefault: boolean, foldGroups: boolean) => void;
  onToggleDefault: (search: SavedSearch) => void;
  onDeleteSavedSearch: (search: SavedSearch) => void;
  t: (text: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [saveFolded, setSaveFolded] = useState(true);
  const ref = useClickOutside(() => setOpen(false));

  function toggleCategory(id: number) {
    const next = new Set(filterCategoryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onFilterCategoryIdsChange(next);
  }

  const dateOptions = getDateOptions();
  const activeCount = filterCategoryIds.size + (dateFilter ? 1 : 0) + (groupByFields.length > 0 ? 1 : 0);

  return (
    <div ref={ref} className="inline-block flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={activeCount === 0 ? t("Filter") : `${t("Filter")} (${activeCount})`}
        title={t("Filter")}
        className="text-muted flex items-center rounded-lg bg-[var(--track-bg)] p-[3px] transition-colors hover:bg-[var(--accent)]/15 hover:text-[var(--accent)]"
      >
        <FilterIcon className="h-3.5 w-3.5 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 pt-1.5">
          <div className="glass-card grid w-[min(640px,calc(100vw-2rem))] grid-cols-1 gap-4 rounded-xl p-4 shadow-lg sm:grid-cols-3">
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

              <div className="space-y-0.5 border-t border-[var(--card-border)] pt-2">
                {getQuickDateOptions().map((opt) => {
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
                      {t(opt.label)}
                    </button>
                  );
                })}
              </div>

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
                        {t(opt.label)}
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
                  const position = groupByFields.indexOf(opt.value);
                  const active = position !== -1;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggleGroupField(opt.value)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    >
                      <span
                        className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border text-[9px] font-bold leading-none ${
                          active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--input-border)]"
                        }`}
                      >
                        {active ? position + 1 : ""}
                      </span>
                      {t(opt.label)}
                    </button>
                  );
                })}
              </div>
              {groupByFields.length > 0 && (
                <p className="text-faint mt-1.5 px-2 text-xs">
                  {groupByFields.map((f) => t(GROUP_OPTIONS.find((o) => o.value === f)!.label)).join(" → ")}
                </p>
              )}
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
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md hover:bg-amber-400/15 ${
                        s.is_default ? "text-amber-400" : "text-faint opacity-0 hover:text-amber-400 group-hover/fav:opacity-100"
                      }`}
                    >
                      <StarIcon filled={s.is_default} className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedSearch(s)}
                      aria-label={t("Delete")}
                      className="text-faint flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md opacity-0 hover:bg-rose-500/15 hover:text-rose-400 group-hover/fav:opacity-100"
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
                    onSaveCurrentSearch(saveName.trim(), saveAsDefault, saveFolded);
                    setSaveName("");
                    setSaveAsDefault(false);
                    setSaveFolded(true);
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
              <label className="text-muted mt-1.5 flex cursor-pointer items-center gap-1.5 px-2 text-xs">
                <input
                  type="checkbox"
                  checked={saveFolded}
                  onChange={(e) => setSaveFolded(e.target.checked)}
                  className="accent-indigo-500 h-3 w-3 flex-shrink-0"
                />
                {t("Fold groups")}
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
  const [groupByFields, setGroupByFields] = useState<GroupField[]>([]);
  // Set by applySavedSearch right before changing groupByFields, so the
  // fold-on-groupBy-change logic below can honor that search's own
  // fold_groups choice instead of always defaulting to folded. Consumed
  // (and cleared back to null) the moment it's used.
  const [foldOnApply, setFoldOnApply] = useState<boolean | null>(null);

  function toggleGroupField(field: GroupField) {
    setGroupByFields((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
  }
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editingRange, setEditingRange] = useState(false);
  const [rangeInput, setRangeInput] = useState("");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedDefaultSearch = useRef(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [bulkEditIds, setBulkEditIds] = useState<number[] | null>(null);
  const [bulkFields, setBulkFields] = useState({ type: false, amount: false, category: false, date: false, note: false });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const actionsMenuRef = useClickOutside(() => setActionsMenuOpen(false));

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
        setSelectedIds(new Set());
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
    // Check the quick options (This Week/This Month/Last Month) before
    // the full Date list - "This Month" and "September" can both carry
    // the same month value, and whichever list is searched first wins
    // the label shown as active, so the quick, more-specific label
    // needs first refusal rather than always losing to the full list.
    if (search.month) {
      const match = getQuickDateOptions().find((o) => o.month === search.month) ?? getDateOptions().find((o) => o.month === search.month);
      setDateFilter(match ?? { label: search.month, month: search.month });
    } else if (search.date_from || search.date_to) {
      const match =
        getQuickDateOptions().find((o) => o.from === search.date_from && o.to === search.date_to) ??
        getDateOptions().find((o) => o.from === search.date_from && o.to === search.date_to);
      setDateFilter(match ?? { label: t("Custom range"), from: search.date_from, to: search.date_to });
    } else {
      setDateFilter(null);
    }
    setFoldOnApply(search.fold_groups);
    setGroupByFields((search.group_by || "").split(",").filter(Boolean) as GroupField[]);
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

  async function handleSaveCurrentSearch(name: string, isDefault: boolean, foldGroups: boolean) {
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
          group_by: groupByFields.join(","),
          fold_groups: foldGroups,
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

  function toggleSort(column: SortColumn) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortColumn(null);
      setSortDir(null);
    }
  }

  const searchedRows = searchQuery.trim()
    ? rows.filter((r) => r.note?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : rows;

  function sortValue(r: Transaction, column: Exclude<SortColumn, null>): string | number {
    switch (column) {
      case "date":
        return r.date;
      case "category":
        return (r.category_name || t("Uncategorized")).toLowerCase();
      case "note":
        return (r.note || "").toLowerCase();
      case "amount":
        return parseFloat(r.amount) * (r.type === "income" ? 1 : -1);
    }
  }

  const sortedRows =
    sortColumn === null
      ? searchedRows
      : [...searchedRows].sort((a, b) => {
          const va = sortValue(a, sortColumn);
          const vb = sortValue(b, sortColumn);
          const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
          return sortDir === "asc" ? cmp : -cmp;
        });

  const totalRows = sortedRows.length;
  const clampedRangeStart = Math.min(rangeStart, Math.max(1, totalRows));
  const rangeEnd = Math.min(clampedRangeStart + pageSize - 1, totalRows);
  const pagedRows = sortedRows.slice(clampedRangeStart - 1, rangeEnd);
  const hasPrev = clampedRangeStart > 1;
  const hasNext = rangeEnd < totalRows;

  function commitRangeInput() {
    setEditingRange(false);
    const typedEnd = parseInt(rangeInput, 10);
    if (!Number.isFinite(typedEnd) || typedEnd < clampedRangeStart) return;
    setPageSize(Math.min(typedEnd, totalRows) - clampedRangeStart + 1);
  }

  // Whenever the filtered/sorted/grouped row set changes shape, snap
  // back to the first page - staying on a later range after narrowing
  // a filter down would otherwise show an empty table. The page size
  // itself is left alone, since it's a manually-set viewing preference.
  // Any row selection is dropped too, since the ids it references may
  // no longer even be in the visible set. Adjusted directly during
  // render (React's documented escape hatch for resetting state when a
  // prop/derived value changes) rather than in an effect, so the reset
  // lands in the same render pass instead of a visible extra one.
  const groupByKey = groupByFields.join(",");
  const resetKey = `${filterCategoryIdsKey}|${dateFilter ? JSON.stringify(dateFilter) : ""}|${searchQuery}|${sortColumn}|${sortDir}|${groupByKey}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setRangeStart(1);
    setSelectedIds(new Set());
  }

  const groups = groupByFields.length === 0 ? null : buildGroups(sortedRows, groupByFields, t);

  // Groups start folded by default whenever Group By is newly turned on
  // or its chain of fields changes (e.g. Type -> Category) - only the
  // totals line is useful at a glance for a dozen groups; expanding is
  // an explicit per-group choice from there via toggleGroupCollapse.
  // Every level's path is folded, not just the top one, so switching
  // to a two-level chain doesn't leave the new inner groups expanded.
  // A saved search can override this via its own fold_groups choice
  // (see applySavedSearch, which sets foldOnApply right before changing
  // groupByFields). This also re-triggers on the empty-to-loaded edge
  // of `rows` (not just on groupByKey), because the default saved
  // search can apply before the initial transactions fetch resolves -
  // group paths computed against zero rows are just "", so without
  // this, groups would render as if never folded once the real rows
  // (and their real group labels) show up a moment later. foldOnApply
  // itself is only cleared once it's been applied against real rows,
  // so this second pass reuses the same decision instead of resetting
  // to the folded default. Adjusted during render (see resetKey above)
  // rather than in an effect.
  const hasRows = rows.length > 0;
  const foldTriggerKey = `${groupByKey}|${hasRows}`;
  const [prevFoldTriggerKey, setPrevFoldTriggerKey] = useState(foldTriggerKey);
  if (foldTriggerKey !== prevFoldTriggerKey) {
    setPrevFoldTriggerKey(foldTriggerKey);
    const shouldFold = foldOnApply ?? true;
    if (hasRows && foldOnApply !== null) setFoldOnApply(null);
    setCollapsedGroups(groups && shouldFold ? new Set(collectGroupPaths(groups)) : new Set());
  }

  const visibleRows = groups ? sortedRows : pagedRows;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => selectedIds.has(r.id));
  const someVisibleSelected = visibleRows.some((r) => selectedIds.has(r.id));
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleRows.forEach((r) => next.delete(r.id));
      else visibleRows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function toggleSelectRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => apiFetch(`/api/transactions/${id}`, { method: "DELETE" })));
      setBulkDeleteOpen(false);
      loadData();
    } catch {
      setError("Couldn't delete the selected transactions");
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleGroupCollapse(path: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderGroupNode(node: GroupNode, depth: number) {
    const collapsed = collapsedGroups.has(node.path);
    return (
      <Fragment key={node.path}>
        <tr className="cursor-pointer bg-white/[0.03] hover:bg-white/[0.06]" onClick={() => toggleGroupCollapse(node.path)}>
          <td></td>
          <td colSpan={3} className="py-1.5 pr-3 text-xs font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5" style={{ paddingLeft: `${depth * 1.25}rem` }}>
              <ChevronIcon className={`h-3 w-3 flex-shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
              {node.label}
            </span>
          </td>
          <td className={`whitespace-nowrap py-1.5 pr-3 text-right text-xs font-bold ${node.total >= 0 ? "text-pos" : "text-neg"}`}>
            {node.total >= 0 ? "+" : "-"}
            {money(String(Math.abs(node.total)))}
          </td>
          <td></td>
        </tr>
        {!collapsed &&
          (node.children ? node.children.map((child) => renderGroupNode(child, depth + 1)) : node.rows.map(renderRow))}
      </Fragment>
    );
  }

  function firstCategoryId(type: "expense" | "income"): string {
    const match = categories.find((c) => c.type === type) ?? categories[0];
    return match ? String(match.id) : "";
  }

  function selectType(type: "expense" | "income") {
    setForm((prev) => ({
      ...prev,
      type,
      categoryId: categories.some((c) => String(c.id) === prev.categoryId && c.type === type)
        ? prev.categoryId
        : firstCategoryId(type),
    }));
  }

  function openAddModal() {
    setEditingId(null);
    setBulkEditIds(null);
    setForm({ ...emptyForm(), categoryId: firstCategoryId("expense") });
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(r: Transaction) {
    setEditingId(r.id);
    setBulkEditIds(null);
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

  function fieldHeader(label: string, key: keyof typeof bulkFields) {
    return (
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-muted text-xs font-semibold uppercase tracking-wider">{label}</label>
        {bulkEditIds && (
          <label className="text-muted flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={bulkFields[key]}
              onChange={(e) => setBulkFields({ ...bulkFields, [key]: e.target.checked })}
              className="accent-indigo-500 h-3.5 w-3.5"
            />
            {t("Change")}
          </label>
        )}
      </div>
    );
  }

  function openBulkEditModal() {
    setEditingId(null);
    setBulkEditIds(Array.from(selectedIds));
    setForm({ ...emptyForm(), categoryId: firstCategoryId("expense") });
    setBulkFields({ type: false, amount: false, category: false, date: false, note: false });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (bulkEditIds) {
      const partialBody: Record<string, unknown> = {};
      if (bulkFields.type) partialBody.type = form.type;
      if (bulkFields.amount) partialBody.amount = form.amount;
      if (bulkFields.category) partialBody.category = form.categoryId ? Number(form.categoryId) : null;
      if (bulkFields.date) partialBody.date = form.date;
      if (bulkFields.note) partialBody.note = form.note || null;
      if (Object.keys(partialBody).length === 0) {
        setError("Check at least one field to change");
        return;
      }
      setSaving(true);
      try {
        const body = JSON.stringify(partialBody);
        await Promise.all(bulkEditIds.map((id) => apiFetch<Transaction>(`/api/transactions/${id}`, { method: "PATCH", body })));
        setModalOpen(false);
        setBulkEditIds(null);
        loadData();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't update the selected transactions");
      } finally {
        setSaving(false);
      }
      return;
    }
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

  function sortIndicator(column: SortColumn) {
    return (
      <span className="w-3 text-left">
        {sortColumn === column ? (
          sortDir === "asc" ? (
            "↑"
          ) : (
            "↓"
          )
        ) : (
          <span className="opacity-0 group-hover:opacity-50">↕</span>
        )}
      </span>
    );
  }

  function renderRow(r: Transaction) {
    return (
      <tr key={r.id} className={`hover:bg-[var(--track-bg)] ${selectedIds.has(r.id) ? "bg-[var(--track-bg)]" : ""}`}>
        <td className="py-2 pl-3 pr-3">
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={() => toggleSelectRow(r.id)}
            aria-label={t("Select row")}
            className="accent-[var(--accent)] h-3.5 w-3.5 flex-shrink-0"
          />
        </td>
        <td className="whitespace-nowrap py-2 pr-3">{r.date}</td>
        <td className="whitespace-nowrap py-2 pr-3">{r.category_name || t("Uncategorized")}</td>
        <td className="text-muted w-full py-2 pr-3">{r.note || ""}</td>
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
        onClose={() => {
          setModalOpen(false);
          setBulkEditIds(null);
        }}
        title={bulkEditIds ? `${t("Edit")} ${bulkEditIds.length} ${t("transactions")}` : editingId ? t("Edit transaction") : t("Add transaction")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={bulkEditIds && !bulkFields.type ? "opacity-50" : ""}>
            {fieldHeader("Type", "type")}
            <div className="grid grid-cols-2 gap-2">
              <label className="input flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 has-[:checked]:border-indigo-400">
                <input
                  type="radio"
                  checked={form.type === "expense"}
                  disabled={!!bulkEditIds && !bulkFields.type}
                  onChange={() => selectType("expense")}
                  className="accent-indigo-500"
                />{" "}
                {t("Expense")}
              </label>
              <label className="input flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 has-[:checked]:border-indigo-400">
                <input
                  type="radio"
                  checked={form.type === "income"}
                  disabled={!!bulkEditIds && !bulkFields.type}
                  onChange={() => selectType("income")}
                  className="accent-indigo-500"
                />{" "}
                {t("Income")}
              </label>
            </div>
          </div>
          <div className={bulkEditIds && !bulkFields.amount ? "opacity-50" : ""}>
            {fieldHeader(t("Amount"), "amount")}
            <input
              type="number"
              step="0.01"
              min="0"
              required={!bulkEditIds || bulkFields.amount}
              disabled={!!bulkEditIds && !bulkFields.amount}
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div className={bulkEditIds && !bulkFields.category ? "opacity-50" : ""}>
            {fieldHeader(t("Category"), "category")}
            <select
              value={form.categoryId}
              disabled={!!bulkEditIds && !bulkFields.category}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            >
              {categories
                // Narrowed to the matching side (Expense/Income) so the
                // dropdown doesn't mix in categories meant for the other
                // type - except the transaction's own already-assigned
                // category, kept visible even if it's a mismatch (e.g.
                // data from before categories had a type) so switching
                // it open never silently swaps the selection out from
                // under the user.
                .filter((c) => c.type === form.type || String(c.id) === form.categoryId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className={bulkEditIds && !bulkFields.date ? "opacity-50" : ""}>
            {fieldHeader(t("Date"), "date")}
            <input
              type="date"
              required={!bulkEditIds || bulkFields.date}
              disabled={!!bulkEditIds && !bulkFields.date}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div className={bulkEditIds && !bulkFields.note ? "opacity-50" : ""}>
            {fieldHeader(t("Note (optional)"), "note")}
            <input
              type="text"
              disabled={!!bulkEditIds && !bulkFields.note}
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

      <Modal
        id="bulkDeleteModal"
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={t("Delete transactions")}
      >
        <div className="space-y-4">
          <p className="text-sm">
            {t("Are you sure you want to delete")} {selectedIds.size} {t("transaction(s)? This action cannot be undone.")}
          </p>
          {error && bulkDeleteOpen && <p className="text-neg text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(false)}
              className="action-btn text-muted flex-1 rounded-xl bg-white/10 py-3 font-semibold hover:bg-white/15"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="action-btn text-neg flex-1 rounded-xl bg-white/10 py-3 font-semibold hover:bg-rose-500/20 disabled:opacity-60"
            >
              {t("Delete")}
            </button>
          </div>
        </div>
      </Modal>

      <div className="relative mb-4 flex flex-wrap items-center gap-2">
        {selectedIds.size > 0 ? (
          <div className="flex h-[38px] flex-1 flex-wrap items-center justify-center gap-2 text-sm">
            <span className="flex h-full items-center gap-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-sm font-semibold text-[var(--accent)]">
              {selectedIds.size} {t("selected")}
              {selectedIds.size < sortedRows.length && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set(sortedRows.map((r) => r.id)))}
                  className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-white hover:bg-[var(--accent)]/80"
                >
                  {t("Select all")} {sortedRows.length}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                aria-label={t("Clear selection")}
                className="hover:text-main"
              >
                ✕
              </button>
            </span>
            <div ref={actionsMenuRef} className="relative h-full">
              <button
                type="button"
                onClick={() => setActionsMenuOpen((v) => !v)}
                className="action-btn text-main flex h-full items-center gap-1.5 rounded-lg bg-[var(--track-bg)] px-3 text-sm font-semibold hover:bg-[var(--accent)]/15 hover:text-[var(--accent)]"
              >
                {t("Actions")} <ChevronIcon className="h-3 w-3" />
              </button>
              {actionsMenuOpen && (
                <div className="glass-card absolute left-0 top-full z-10 mt-2 w-36 space-y-1 rounded-xl p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      openBulkEditModal();
                    }}
                    className="nav-link block w-full rounded-lg px-3 py-2 text-left text-sm"
                  >
                    {t("Edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setBulkDeleteOpen(true);
                    }}
                    className="text-neg block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-rose-500/10"
                  >
                    {t("Delete")}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className="flex min-h-[38px] min-w-[220px] flex-1 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm">
          <SearchIcon className="text-faint h-3.5 w-3.5 flex-shrink-0" />
          {filterCategoryIds.size > 0 && (
            <span className="text-muted flex items-center gap-1.5 rounded-lg bg-[var(--track-bg)] px-2 py-0.5 text-xs font-semibold">
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
            <span className="text-muted flex items-center gap-1.5 rounded-lg bg-[var(--track-bg)] px-2 py-0.5 text-xs font-semibold">
              <CalendarIcon className="h-3 w-3 flex-shrink-0" />
              {t(dateFilter.label)}
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
          {groupByFields.length > 0 && (
            <span className="text-muted flex items-center gap-1.5 rounded-lg bg-[var(--track-bg)] px-2 py-0.5 text-xs font-semibold">
              <GroupIcon className="h-3 w-3 flex-shrink-0" />
              {groupByFields.map((f) => t(GROUP_OPTIONS.find((opt) => opt.value === f)!.label)).join(" → ")}
              <button
                type="button"
                onClick={() => setGroupByFields([])}
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
              if (groupByFields.length > 0) setGroupByFields([]);
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
            groupByFields={groupByFields}
            onToggleGroupField={toggleGroupField}
            savedSearches={savedSearches}
            onApplySavedSearch={applySavedSearch}
            onSaveCurrentSearch={handleSaveCurrentSearch}
            onToggleDefault={handleToggleDefault}
            onDeleteSavedSearch={handleDeleteSavedSearch}
            t={t}
          />
        </div>
        )}
        {!groups && totalRows > pageSize && (
          <div className="flex h-[38px] flex-shrink-0 items-center gap-2 text-sm font-semibold">
            {editingRange ? (
              <input
                type="number"
                min={clampedRangeStart}
                max={totalRows}
                autoFocus
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                onBlur={commitRangeInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRangeInput();
                  else if (e.key === "Escape") setEditingRange(false);
                }}
                className="input h-full w-16 rounded-lg px-2 text-center text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRangeInput(String(rangeEnd));
                  setEditingRange(true);
                }}
                title={t("Click to set page size")}
                className="text-muted hover:text-main"
              >
                {clampedRangeStart}-{rangeEnd} / {totalRows}
              </button>
            )}
            <div className="flex h-full items-center rounded-lg bg-[var(--track-bg)]">
              <button
                type="button"
                onClick={() => setRangeStart(Math.max(1, clampedRangeStart - pageSize))}
                disabled={!hasPrev}
                aria-label={t("Previous page")}
                className="text-muted flex h-full items-center rounded-lg px-2.5 hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--muted)]"
              >
                <ChevronIcon className="h-3.5 w-3.5 rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => setRangeStart(rangeEnd + 1)}
                disabled={!hasNext}
                aria-label={t("Next page")}
                className="text-muted flex h-full items-center rounded-lg px-2.5 hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--muted)]"
              >
                <ChevronIcon className="h-3.5 w-3.5 -rotate-90" />
              </button>
            </div>
          </div>
        )}
      </div>

      {importMessage && <p className="text-pos mb-3 text-sm">{importMessage}</p>}
      {error && !modalOpen && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {searchedRows.length === 0 ? (
          <p className="text-faint text-sm">{t("No transactions match this filter.")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="txn-table w-full text-left text-sm">
              <thead>
                <tr className="text-main text-xs uppercase tracking-wider">
                  <th className="pb-2 pl-3 pr-3">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label={t("Select all")}
                      className="accent-[var(--accent)] h-3.5 w-3.5 flex-shrink-0"
                    />
                  </th>
                  <th className="pb-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("date")}
                      className="group inline-flex items-center gap-1 uppercase tracking-wider"
                    >
                      {t("Date")}
                      {sortIndicator("date")}
                    </button>
                  </th>
                  <th className="pb-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("category")}
                      className="group inline-flex items-center gap-1 uppercase tracking-wider"
                    >
                      {t("Category")}
                      {sortIndicator("category")}
                    </button>
                  </th>
                  <th className="w-full pb-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("note")}
                      className="group inline-flex items-center gap-1 uppercase tracking-wider"
                    >
                      {t("Note")}
                      {sortIndicator("note")}
                    </button>
                  </th>
                  <th className="pb-2 pr-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className="group flex w-full items-center justify-end gap-1 uppercase tracking-wider"
                    >
                      {sortIndicator("amount")}
                      {t("Amount")}
                    </button>
                  </th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>{groups ? groups.map((g) => renderGroupNode(g, 0)) : pagedRows.map(renderRow)}</tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
