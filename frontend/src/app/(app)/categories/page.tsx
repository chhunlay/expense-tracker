"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import ColorPicker from "@/components/ColorPicker";
import Modal from "@/components/Modal";
import { EditIcon } from "@/components/icons";
import { useTranslation } from "@/lib/i18n";
import { Category } from "@/types";

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CategoryRow({ category, onSaved, onDeleted }: {
  category: Category;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [budget, setBudget] = useState(category.budget_limit ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, color, budget_limit: budget || null }),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("Delete this category? Its past transactions become Uncategorized."))) return;
    try {
      await apiFetch(`/api/categories/${category.id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      setError("Couldn't delete category");
    }
  }

  return (
    <div
      className="input rounded-xl px-3 py-2.5"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between text-sm"
      >
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} />
          {category.name}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted text-xs">
            {money(category.spent_this_month)}
            {category.budget_limit && ` / ${money(parseFloat(category.budget_limit))}`} {t("this month")}
          </span>
          <EditIcon className="text-muted h-3.5 w-3.5 flex-shrink-0" />
        </span>
      </button>
      {open && (
        <>
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
              <ColorPicker value={color} onChange={setColor} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={t("Monthly budget (optional)")}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="input w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-neg mt-2 text-xs">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="text-neg rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/20"
            >
              {t("Delete")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {t("Save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  function loadCategories() {
    apiFetch<Category[]>("/api/categories")
      .then(setCategories)
      .catch(() => setError("Couldn't load categories"));
  }

  useEffect(loadCategories, []);

  function openModal() {
    setName("");
    setColor("#6366f1");
    setBudget("");
    setError(null);
    setModalOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch<Category>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name, color, budget_limit: budget || null }),
      });
      setModalOpen(false);
      loadCategories();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("Categories")}</h2>
        <button
          type="button"
          onClick={openModal}
          className="action-btn rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
        >
          + {t("Add")}
        </button>
      </div>

      <Modal id="addCategoryModal" open={modalOpen} onClose={() => setModalOpen(false)} title={t("Add a category")}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Name & color")}
            </label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <ColorPicker value={color} onChange={setColor} swatchClassName="h-10 w-10" />
              <input
                type="text"
                required
                placeholder={t("Category name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Monthly budget (optional)")}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="input w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          {error && <p className="text-neg text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="action-btn text-muted flex-1 rounded-xl bg-white/10 py-3 font-semibold hover:bg-white/15"
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="action-btn flex-1 rounded-xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
            >
              {t("Add category")}
            </button>
          </div>
        </form>
      </Modal>

      {error && !modalOpen && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {categories.length === 0 ? (
          <p className="text-faint text-sm">No categories yet.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} onSaved={loadCategories} onDeleted={loadCategories} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
