"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Modal from "@/components/Modal";
import { ASSET_TYPES, Asset } from "@/types";

function money(value: string): string {
  return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AssetRow({ asset, onSaved, onDeleted }: {
  asset: Asset;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(asset.name);
  const [assetType, setAssetType] = useState(asset.asset_type);
  const [value, setValue] = useState(asset.value);
  const [note, setNote] = useState(asset.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/assets/${asset.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ name, asset_type: assetType, value, note: note || null }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save asset");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this asset?")) return;
    try {
      await apiFetch(`/api/assets/${asset.id}/`, { method: "DELETE" });
      onDeleted();
    } catch {
      setError("Couldn't delete asset");
    }
  }

  return (
    <details className="input rounded-xl px-3 py-2.5">
      <summary className="flex cursor-pointer items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="text-muted rounded-full bg-white/10 px-2 py-0.5 text-xs">
            {ASSET_TYPES.find((t) => t.value === asset.asset_type)?.label}
          </span>
          {asset.name}
        </span>
        <span className="text-muted text-xs font-semibold">{money(asset.value)}</span>
      </summary>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as Asset["asset_type"])}
            className="input rounded-lg px-3 py-2 text-sm"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input w-full rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
          Delete
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </details>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<Asset["asset_type"]>("bank");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function loadAssets() {
    apiFetch<Asset[]>("/api/assets/")
      .then(setAssets)
      .catch(() => setError("Couldn't load assets"));
  }

  useEffect(loadAssets, []);

  const totalValue = assets.reduce((sum, a) => sum + parseFloat(a.value), 0);

  function openModal() {
    setName("");
    setAssetType("bank");
    setValue("");
    setNote("");
    setError(null);
    setModalOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch<Asset>("/api/assets/", {
        method: "POST",
        body: JSON.stringify({ name, asset_type: assetType, value, note: note || null }),
      });
      setModalOpen(false);
      loadAssets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Assets</h2>
          <p className="text-muted mt-0.5 text-xs">
            Net worth: <span className="text-main font-semibold">{money(String(totalValue))}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="action-btn rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
        >
          + Add
        </button>
      </div>

      <Modal id="addAssetModal" open={modalOpen} onClose={() => setModalOpen(false)} title="Add an asset">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Savings account"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as Asset["asset_type"])}
              className="input w-full rounded-xl px-3 py-2.5 text-sm"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              Current value
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="action-btn flex-1 rounded-xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
            >
              Add asset
            </button>
          </div>
        </form>
      </Modal>

      {error && !modalOpen && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {assets.length === 0 ? (
          <p className="text-faint text-sm">No assets yet. Add your first one.</p>
        ) : (
          <div className="space-y-2">
            {assets.map((a) => (
              <AssetRow key={a.id} asset={a} onSaved={loadAssets} onDeleted={loadAssets} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
