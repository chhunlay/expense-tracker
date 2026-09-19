"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import { ASSET_TYPES, Asset } from "@/types";

function money(value: string): string {
  return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AssetsContent() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<Asset["asset_type"]>("bank");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  function loadAssets() {
    apiFetch<Asset[]>("/api/assets/")
      .then(setAssets)
      .catch(() => setError("Couldn't load assets"));
  }

  useEffect(loadAssets, []);

  const totalValue = assets.reduce((sum, a) => sum + parseFloat(a.value), 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch<Asset>("/api/assets/", {
        method: "POST",
        body: JSON.stringify({ name, asset_type: assetType, value }),
      });
      setName("");
      setValue("");
      loadAssets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add asset");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this asset?")) return;
    try {
      await apiFetch(`/api/assets/${id}/`, { method: "DELETE" });
      loadAssets();
    } catch {
      setError("Couldn't delete asset");
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Assets</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Net worth: <span className="font-semibold text-slate-100">{money(String(totalValue))}</span>
          </p>
        </div>

        <form
          onSubmit={handleAdd}
          className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-4"
        >
          <input
            type="text"
            required
            placeholder="e.g. Savings account"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm"
          />
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as Asset["asset_type"])}
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Current value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            + Add
          </button>
        </form>

        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          {assets.length === 0 ? (
            <p className="text-sm text-slate-400">No assets yet. Add your first one.</p>
          ) : (
            <div className="space-y-2">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/30 px-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">
                      {ASSET_TYPES.find((t) => t.value === a.asset_type)?.label}
                    </span>
                    {a.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold">{money(a.value)}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function AssetsPage() {
  return (
    <RequireAuth>
      <AssetsContent />
    </RequireAuth>
  );
}
