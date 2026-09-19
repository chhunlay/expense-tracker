"use client";

import { useEffect, useState } from "react";

import { applyTheme, setStoredTheme, Theme } from "@/lib/theme";

/** Same pill switch as the old sidebar/mobile-header toggle - moon on a
 * dark track, sun sliding to a light track. Reads the theme the inline
 * script in layout.tsx already applied to <html> on first render, so
 * there's nothing to do before mount here beyond mirroring it into
 * this button's own state for the thumb position. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Reads an external system (the <html> attribute the inline script
    // in layout.tsx set before paint) - not available during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    setStoredTheme(next);
  }

  return (
    <button type="button" onClick={toggle} className="theme-switch" aria-label="Toggle theme">
      <span className="theme-switch-thumb">{theme === "light" ? "☀️" : "🌙"}</span>
    </button>
  );
}
