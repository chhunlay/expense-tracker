"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL, apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { applyAccent, DEFAULT_ACCENT, getStoredAccent, setStoredAccent } from "@/lib/theme";
import { Profile } from "@/types";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "km", label: "ភាសាខ្មែរ" },
];

// Preset swatches for the accent color picker - the active sidebar
// item, active mobile nav tab, etc. (see globals.css's --accent) all
// follow whichever of these (or a custom color) is picked below.
const ACCENT_PRESETS = ["#f97316", "#6366f1", "#ec4899", "#10b981", "#06b6d4", "#eab308"];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    apiFetch<Profile>("/api/profile")
      .then(setProfile)
      .catch(() => setError("Couldn't load your profile"));
    // Reads an external system (localStorage) not available during
    // SSR - see AppShell's auth-check effect for the same pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccentColor(getStoredAccent() || DEFAULT_ACCENT);
  }, []);

  function handleAccentColorChange(color: string) {
    setAccentColor(color);
    applyAccent(color);
    setStoredAccent(color);
  }

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
            <h3 className="mb-3 text-sm font-semibold">Accent color</h3>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleAccentColorChange(color)}
                  aria-label={`Use ${color} as the accent color`}
                  className="h-8 w-8 flex-shrink-0 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: color,
                    outline: accentColor === color ? "2px solid var(--text-main)" : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
              <label className="text-muted flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-current">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleAccentColorChange(e.target.value)}
                  className="h-0 w-0 opacity-0"
                />
                +
              </label>
            </div>
            <p className="text-faint mt-2.5 text-xs">Used for the active sidebar item and other highlights.</p>
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
