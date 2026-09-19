"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Category } from "@/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  function loadCategories() {
    apiFetch<Category[]>("/api/categories/")
      .then(setCategories)
      .catch(() => setError("Couldn't load categories"));
  }

  useEffect(loadCategories, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch<Category>("/api/categories/", {
        method: "POST",
        body: JSON.stringify({ name, color, budget_limit: budget || null }),
      });
      setName("");
      setBudget("");
      loadCategories();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this category? Its past transactions become Uncategorized.")) return;
    try {
      await apiFetch(`/api/categories/${id}/`, { method: "DELETE" });
      loadCategories();
    } catch {
      setError("Couldn't delete category");
    }
  }

  return (
    <AppShell>
      <h2 className="mb-4 text-lg font-bold">Categories</h2>

      <form onSubmit={handleAdd} className="glass-card mb-5 grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-4">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-full rounded-lg border-0 bg-transparent"
        />
        <input
          type="text"
          required
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input rounded-xl px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Monthly budget (optional)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="input rounded-xl px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="action-btn rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
        >
          + Add
        </button>
      </form>

      {error && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {categories.length === 0 ? (
          <p className="text-faint text-sm">No categories yet.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="input flex items-center justify-between rounded-xl px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  {c.budget_limit && <span className="text-faint text-xs">budget ${c.budget_limit}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="text-neg rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/20"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
