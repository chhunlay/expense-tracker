"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL, apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Profile } from "@/types";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "km", label: "ភាសាខ្មែរ" },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Profile>("/api/profile")
      .then(setProfile)
      .catch(() => setError("Couldn't load your profile"));
  }, []);

  async function handleThemeChange(theme: Profile["theme"]) {
    setError(null);
    try {
      const updated = await apiFetch<Profile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ theme }),
      });
      setProfile(updated);
      setMessage("Theme updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update theme");
    }
  }

  async function handleLanguageChange(language: string) {
    setError(null);
    try {
      const updated = await apiFetch<Profile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ language }),
      });
      setProfile(updated);
      setMessage("Language updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update language");
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("picture", file);
      const updated = await apiFetch<Profile>("/api/profile/picture", { method: "POST", body: formData });
      setProfile(updated);
      setFile(null);
      setMessage("Profile picture updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload picture");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h2 className="mb-4 text-lg font-bold">Settings</h2>

      {message && <p className="text-pos mb-3 text-sm">{message}</p>}
      {error && <p className="text-neg mb-3 text-sm">{error}</p>}

      {profile && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold">Profile picture</h3>
            <form onSubmit={handleUpload} className="flex items-center gap-4">
              {profile.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_BASE_URL}${profile.picture}`}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-lg font-bold text-white">
                  {profile.username[0]?.toUpperCase()}
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="input flex-1 rounded-xl px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!file || saving}
                className="action-btn flex-shrink-0 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-60"
              >
                Upload
              </button>
            </form>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold">Color theme</h3>
            <select
              value={profile.theme}
              onChange={(e) => handleThemeChange(e.target.value as Profile["theme"])}
              className="input rounded-xl px-3 py-2 text-sm"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold">Language</h3>
            <select
              value={profile.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="input rounded-xl px-3 py-2 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </AppShell>
  );
}
