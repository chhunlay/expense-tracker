"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { register } from "@/lib/auth";
import PasswordField from "@/components/PasswordField";
import { WalletIcon } from "@/components/icons";
import { useTranslation } from "@/lib/i18n";

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await register(username, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15">
            <WalletIcon />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Expense Tracker</h1>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="mb-4 text-lg font-bold">{t("Create account")}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
                {t("Username")}
              </label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input w-full rounded-xl px-3 py-2.5"
              />
            </div>
            <div>
              <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
                {t("Password")}
              </label>
              <PasswordField value={password} onChange={setPassword} minLength={8} />
            </div>
            <div>
              <label className="text-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
                {t("Confirm password")}
              </label>
              <PasswordField value={confirm} onChange={setConfirm} />
            </div>
            {error && <p className="text-neg text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="action-btn w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
            >
              {loading ? "Creating account..." : t("Create account")}
            </button>
          </form>
          <p className="text-faint mt-4 text-center text-sm">
            {t("Already have an account?")}{" "}
            <Link href="/login" className="text-indigo-400 underline">
              {t("Log in")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
