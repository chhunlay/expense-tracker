"use client";

import { useEffect, useState } from "react";

import { onThemePreferenceChange, resolveTheme, ResolvedTheme, setThemePreference } from "@/lib/theme";

/** Same pill switch as the old sidebar/mobile-header toggle - moon on a
 * dark track, sun sliding to a light track. Reads the theme the inline
 * script in layout.tsx already applied to <html> on first render, so
 * there's nothing to do before mount here beyond mirroring it into
 * this button's own state for the thumb position. Clicking it always
 * sets an explicit light/dark preference (overriding "system" if that
 * was picked in Settings' Appearance section), and it also listens
 * for changes made there so its own thumb stays in sync without
 * needing a remount. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    // Reads an external system (the <html> attribute the inline script
    // in layout.tsx set before paint) - not available during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  useEffect(() => onThemePreferenceChange((pref) => setTheme(resolveTheme(pref))), []);

  function toggle() {
    const next: ResolvedTheme = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemePreference(next);
  }

  return (
    <button type="button" onClick={toggle} className="theme-switch" aria-label="Toggle theme">
      <span className="theme-switch-thumb">{theme === "light" ? "☀️" : "🌙"}</span>
    </button>
  );
}
