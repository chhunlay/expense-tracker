"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import Modal from "@/components/Modal";
import { useTranslation } from "@/lib/i18n";
import { ASSET_TYPES, Asset, Transaction } from "@/types";

function money(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Paid/Remaining progress bar + payment history + a small "add a
 * payment" form - shown once an asset has a purchase_price, whether or
 * not it's also depreciating. A payment is just a normal expense
 * transaction tagged with this asset (Transaction.asset), so
 * paid_amount/remaining_balance (from the asset itself) and this list
 * both come straight out of the existing transactions ledger instead
 * of a separate payment table. */
function AssetPayments({ asset, onPaid }: { asset: Asset; onPaid: () => void }) {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Transaction[] | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadPayments() {
    apiFetch<Transaction[]>(`/api/transactions?asset_id=${asset.id}`)
      .then(setPayments)
      .catch(() => setError("Couldn't load payments"));
  }

  useEffect(loadPayments, [asset.id]);

  const totalPrice = asset.purchase_price ? parseFloat(asset.purchase_price) : null;
  const pct = totalPrice ? Math.min(100, Math.round((asset.paid_amount / totalPrice) * 100)) : 0;

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify({ type: "expense", amount, date, asset: asset.id, note: note || null }),
      });
      setAmount("");
      setNote("");
      setDate(today());
      loadPayments();
      onPaid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[var(--input-border)] pt-3">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">{t("Payments")}</span>
        {totalPrice !== null && (
          <span className="text-muted">
            {money(asset.paid_amount)} / {money(totalPrice)}
          </span>
        )}
      </div>
      {totalPrice !== null && (
        <div className="progress-track h-2 w-full overflow-hidden rounded-full">
          <div className="progress-bar h-full" style={{ width: `${pct}%` }} />
        </div>
      )}

      <form onSubmit={handleAddPayment} className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder={t("Amount")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input rounded-lg px-2.5 py-1.5 text-sm"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input rounded-lg px-2.5 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={saving || !amount}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
        >
          {t("Add")}
        </button>
      </form>
      {error && <p className="text-neg mt-1.5 text-xs">{error}</p>}

      {payments && payments.length > 0 && (
        <div className="mt-2 space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-muted">
                {p.date} {p.note && `· ${p.note}`}
              </span>
              <span className="font-medium">{money(parseFloat(p.amount))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetRow({ asset, onSaved, onDeleted }: {
  asset: Asset;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(asset.name);
  const [assetType, setAssetType] = useState(asset.asset_type);
  const [value, setValue] = useState(asset.value);
  const [purchasePrice, setPurchasePrice] = useState(asset.purchase_price ?? "");
  const [purchaseDate, setPurchaseDate] = useState(asset.purchase_date ?? "");
  const [usefulLife, setUsefulLife] = useState(asset.useful_life_years?.toString() ?? "");
  const [note, setNote] = useState(asset.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const { t } = useTranslation();

  const isDepreciating = Boolean(purchasePrice && purchaseDate && usefulLife);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          asset_type: assetType,
          value,
          purchase_price: purchasePrice || null,
          purchase_date: purchaseDate || null,
          useful_life_years: usefulLife ? parseInt(usefulLife, 10) : null,
          note: note || null,
        }),
      });
      if (detailsRef.current) detailsRef.current.open = false;
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save asset");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("Delete this asset?"))) return;
    try {
      await apiFetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      setError("Couldn't delete asset");
    }
  }

  return (
    <details ref={detailsRef} className="input rounded-xl px-3 py-2.5">
      <summary className="flex cursor-pointer items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="text-muted rounded-full bg-white/10 px-2 py-0.5 text-xs">
            {ASSET_TYPES.find((at) => at.value === asset.asset_type)?.label}
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
            {ASSET_TYPES.map((at) => (
              <option key={at.value} value={at.value}>
                {at.label}
              </option>
            ))}
          </select>
        </div>

        {isDepreciating ? (
          <p className="text-muted rounded-lg bg-[var(--track-bg)] px-3 py-2 text-sm">
            {t("Current value (depreciated)")}: <span className="font-semibold">{money(asset.value)}</span>
          </p>
        ) : (
          <input
            type="number"
            step="0.01"
            placeholder={t("Current value")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input w-full rounded-lg px-3 py-2 text-sm"
          />
        )}

        <div>
          <p className="text-faint mb-1 text-xs">
            {t("Purchase price, date & useful life (optional) - enables depreciation and payment tracking")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={t("Purchase price")}
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="input rounded-lg px-2.5 py-2 text-sm"
            />
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="input rounded-lg px-2.5 py-2 text-sm"
            />
            <input
              type="number"
              min="1"
              placeholder={t("Life (years)")}
              value={usefulLife}
              onChange={(e) => setUsefulLife(e.target.value)}
              className="input rounded-lg px-2.5 py-2 text-sm"
            />
          </div>
        </div>

        <input
          type="text"
          placeholder={t("Note (optional)")}
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

      {asset.purchase_price !== null && <AssetPayments asset={asset} onPaid={onSaved} />}
    </details>
  );
}

export default function AssetsPage() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<Asset["asset_type"]>("bank");
  const [value, setValue] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [usefulLife, setUsefulLife] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function loadAssets() {
    apiFetch<Asset[]>("/api/assets")
      .then(setAssets)
      .catch(() => setError("Couldn't load assets"));
  }

  useEffect(loadAssets, []);

  const totalValue = assets.reduce((sum, a) => sum + parseFloat(a.value), 0);

  function openModal() {
    setName("");
    setAssetType("bank");
    setValue("");
    setPurchasePrice("");
    setPurchaseDate("");
    setUsefulLife("");
    setNote("");
    setError(null);
    setModalOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch<Asset>("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          name,
          asset_type: assetType,
          value: value || purchasePrice || "0",
          purchase_price: purchasePrice || null,
          purchase_date: purchaseDate || null,
          useful_life_years: usefulLife ? parseInt(usefulLife, 10) : null,
          note: note || null,
        }),
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
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{t("Assets")}</h2>
          <p className="text-muted mt-0.5 text-xs">
            {t("Net worth")}: <span className="text-main font-semibold">{money(String(totalValue))}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="action-btn rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
        >
          + {t("Add")}
        </button>
      </div>

      <Modal id="addAssetModal" open={modalOpen} onClose={() => setModalOpen(false)} title={t("Add an asset")}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Name")}
            </label>
            <input
              type="text"
              required
              placeholder={t("e.g. Savings account")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Type")}
            </label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as Asset["asset_type"])}
              className="input w-full rounded-xl px-3 py-2.5 text-sm"
            >
              {ASSET_TYPES.map((at) => (
                <option key={at.value} value={at.value}>
                  {at.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Current value")}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Depreciation & payments (optional)")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={t("Purchase price")}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="input rounded-xl px-2.5 py-2.5 text-sm"
              />
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="input rounded-xl px-2.5 py-2.5 text-sm"
              />
              <input
                type="number"
                min="1"
                placeholder={t("Life (years)")}
                value={usefulLife}
                onChange={(e) => setUsefulLife(e.target.value)}
                className="input rounded-xl px-2.5 py-2.5 text-sm"
              />
            </div>
            <p className="text-faint mt-1.5 text-xs">
              {t("Set a purchase price to track installment payments; add date + useful life too for automatic depreciation.")}
            </p>
          </div>
          <div>
            <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
              {t("Note (optional)")}
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
              {t("Cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="action-btn flex-1 rounded-xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
            >
              {t("Add asset")}
            </button>
          </div>
        </form>
      </Modal>

      {error && !modalOpen && <p className="text-neg mb-3 text-sm">{error}</p>}

      <div className="glass-card rounded-2xl p-5">
        {assets.length === 0 ? (
          <p className="text-faint text-sm">{t("No assets yet. Add your first one.")}</p>
        ) : (
          <div className="space-y-2">
            {assets.map((a) => (
              <AssetRow key={a.id} asset={a} onSaved={loadAssets} onDeleted={loadAssets} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
