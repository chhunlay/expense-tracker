"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL, apiFetch, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { MailIcon, PhoneIcon } from "@/components/icons";
import { broadcastProfileUpdate } from "@/lib/profile";
import {
  applyAccent,
  DEFAULT_ACCENT,
  getStoredAccent,
  getStoredSidebarHeaderStyle,
  getStoredTrendHidden,
  setStoredAccent,
  setStoredSidebarHeaderStyle,
  setStoredTrendHidden,
  setThemePreference,
  SidebarHeaderStyle,
} from "@/lib/theme";
import { Profile } from "@/types";

const SIDEBAR_HEADER_OPTIONS: { value: SidebarHeaderStyle; label: string; description: string }[] = [
  { value: "app", label: "App name", description: '"Expense Tracker" with your username underneath.' },
  { value: "user", label: "User profile", description: "Your avatar with your name and username instead." },
];

const APPEARANCE_OPTIONS: { value: Profile["theme"]; label: string; icon: string }[] = [
  { value: "system", label: "System", icon: "🖥️" },
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
];

// Matches the Dashboard trend chart's own dataset colors/labels
// (Income/Expense/Net) - see dashboard/page.tsx.
const TREND_SERIES = [
  { label: "Income", color: "#10b981" },
  { label: "Expense", color: "#f43f5e" },
  { label: "Net", color: "#6366f1" },
] as const;

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
  const [saving, setSaving] = useState(false);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [sidebarHeaderStyle, setSidebarHeaderStyle] = useState<SidebarHeaderStyle>("app");
  const [trendHidden, setTrendHidden] = useState<Set<string>>(new Set());
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    apiFetch<Profile>("/api/profile")
      .then((p) => {
        setProfile(p);
        setFullName(p.full_name);
        setEmail(p.email);
        setPhone(p.phone);
      })
      .catch(() => setError("Couldn't load your profile"));
    // Reads an external system (localStorage) not available during
    // SSR - see AppShell's auth-check effect for the same pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccentColor(getStoredAccent() || DEFAULT_ACCENT);
    setSidebarHeaderStyle(getStoredSidebarHeaderStyle());
    setTrendHidden(getStoredTrendHidden());
  }, []);

  function handleAccentColorChange(color: string) {
    setAccentColor(color);
    applyAccent(color);
    setStoredAccent(color);
  }

  function toggleTrendSeries(label: string) {
    setTrendHidden((prev) => {
      const isCurrentlyVisible = !prev.has(label);
      // At least one series must stay visible - if this is the last
      // one still checked, ignore the click instead of leaving the
      // chart with nothing to show.
      if (isCurrentlyVisible && TREND_SERIES.length - prev.size <= 1) return prev;
      const next = new Set(prev);
      if (isCurrentlyVisible) next.add(label);
      else next.delete(label);
      setStoredTrendHidden(next);
      return next;
    });
  }

  function handleSidebarHeaderStyleChange(style: SidebarHeaderStyle) {
    setSidebarHeaderStyle(style);
    setStoredSidebarHeaderStyle(style);
  }

  async function handleThemeChange(theme: Profile["theme"]) {
    setError(null);
    // Applies (and persists to localStorage) immediately, rather than
    // waiting on the PATCH below - matches the accent color/sidebar
    // header pickers, and means a slow/failed request doesn't leave
    // the picker looking like nothing happened.
    setThemePreference(theme);
    try {
      const updated = await apiFetch<Profile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ theme }),
      });
      setProfile(updated);
      broadcastProfileUpdate(updated);
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
      broadcastProfileUpdate(updated);
      setMessage("Language updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update language");
    }
  }

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("picture", picked);
      const updated = await apiFetch<Profile>("/api/profile/picture", { method: "POST", body: formData });
      setProfile(updated);
      broadcastProfileUpdate(updated);
      setMessage("Profile picture updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload picture");
    } finally {
      setSaving(false);
    }
  }

  async function handleDetailsSave() {
    setError(null);
    try {
      const updated = await apiFetch<Profile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName, email, phone }),
      });
      setProfile(updated);
      broadcastProfileUpdate(updated);
      setMessage("Profile updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update your profile");
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
            <div className="flex items-center gap-4">
              {/* Square avatar, not the old circle - clicking it opens
                  the file picker directly and uploads on selection
                  (no separate Upload button), and hovering swaps in an
                  "Add Photo" overlay instead. */}
              <label className="group relative h-20 w-20 flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl">
                {profile.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_BASE_URL}${profile.picture}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-pink-500 text-2xl font-bold text-white">
                    {(profile.full_name || profile.username)[0]?.toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {saving ? "Uploading…" : "Add Photo"}
                </span>
                <input type="file" accept="image/*" onChange={handlePictureChange} className="hidden" />
              </label>
              {/* Editable in place - typing here IS filling out
                  full_name/email/phone, so there's no separate,
                  duplicate set of labeled fields below anymore. */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={handleDetailsSave}
                  placeholder="Your name"
                  className="w-full truncate rounded-lg bg-transparent text-lg font-bold outline-none focus:bg-[var(--input-bg)] focus:px-2 focus:py-0.5"
                />
                <label className="text-muted flex items-center gap-1.5 rounded-lg text-sm focus-within:bg-[var(--input-bg)] focus-within:px-2 focus-within:py-0.5">
                  <MailIcon />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleDetailsSave}
                    placeholder="you@example.com"
                    className="w-full bg-transparent outline-none"
                  />
                </label>
                <label className="text-muted flex items-center gap-1.5 rounded-lg text-sm focus-within:bg-[var(--input-bg)] focus-within:px-2 focus-within:py-0.5">
                  <PhoneIcon />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={handleDetailsSave}
                    placeholder="+1 555 000 0000"
                    className="w-full bg-transparent outline-none"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold">Appearance</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {APPEARANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleThemeChange(opt.value)}
                  className="input flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-sm"
                  style={
                    profile.theme === opt.value
                      ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" }
                      : undefined
                  }
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
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
            <h3 className="mb-3 text-sm font-semibold">Sidebar header</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SIDEBAR_HEADER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSidebarHeaderStyleChange(opt.value)}
                  className="input rounded-xl px-3 py-2.5 text-left text-sm"
                  style={
                    sidebarHeaderStyle === opt.value
                      ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" }
                      : undefined
                  }
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-faint mt-0.5 block text-xs">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold">Trend chart series</h3>
            <div className="flex flex-wrap gap-4">
              {TREND_SERIES.map(({ label, color }) => (
                <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                  {/* Still a checkbox under the hood (each series
                      toggles independently, not an exclusive group) -
                      just styled round like a radio button per the
                      user's ask, with a guard in toggleTrendSeries()
                      keeping at least one checked. */}
                  <input
                    type="checkbox"
                    checked={!trendHidden.has(label)}
                    onChange={() => toggleTrendSeries(label)}
                    className="radio-checkbox h-4 w-4"
                    style={{ "--dot-color": color } as React.CSSProperties}
                  />
                  <span className="font-semibold" style={{ color }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-faint mt-2.5 text-xs">
              Deselecting one hides it from the Dashboard&apos;s Trend chart - same as clicking it in the chart&apos;s
              own legend. At least one must stay selected.
            </p>
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
