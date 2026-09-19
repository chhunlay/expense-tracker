// Same dark/light scheme as the old script.js: a stored preference in
// localStorage, falling back to the OS/browser's prefers-color-scheme
// when nothing's been chosen yet.
const THEME_KEY = "expense-tracker-theme";
const ACCENT_KEY = "expense-tracker-accent-color";
const SIDEBAR_HEADER_KEY = "expense-tracker-sidebar-header-style";
const TREND_HIDDEN_KEY = "expense-tracker-trend-hidden-datasets";
export const DEFAULT_ACCENT = "#f97316";

// "system" follows the OS/browser's prefers-color-scheme instead of a
// fixed choice - resolveTheme() below turns it into an actual
// "dark"/"light" to apply, since CSS only knows those two.
export type Theme = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";
// "app" is the original "Expense Tracker" logo + username subtitle;
// "user" swaps it for the signed-in user's own avatar/name instead -
// see the Settings page's "Sidebar header" picker.
export type SidebarHeaderStyle = "app" | "user";

export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore - see api.ts's setToken for the same tradeoff
  }
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
}

const THEME_EVENT = "expense-tracker-theme-preference-change";

/** Stores the preference, applies its resolved value, and broadcasts
 * the change - the single entry point for changing the theme, used by
 * both ThemeToggle (always an explicit light/dark) and the Settings
 * page's Appearance picker (which can also set "system"). Same
 * same-tab-live-update need as SIDEBAR_HEADER_EVENT below. */
export function setThemePreference(theme: Theme) {
  setStoredTheme(theme);
  applyTheme(resolveTheme(theme));
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

export function onThemePreferenceChange(callback: (theme: Theme) => void): () => void {
  function handler(e: Event) {
    callback((e as CustomEvent<Theme>).detail);
  }
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}

export function getStoredAccent(): string | null {
  try {
    return localStorage.getItem(ACCENT_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccent(color: string) {
  try {
    localStorage.setItem(ACCENT_KEY, color);
  } catch {
    // ignore - see api.ts's setToken for the same tradeoff
  }
}

/** Sets the --accent CSS variable globals.css's active-nav-item styles
 * (and anything else) read from, the same "set on <html>, read
 * everywhere" pattern applyTheme uses for data-theme. */
export function applyAccent(color: string) {
  document.documentElement.style.setProperty("--accent", color);
}

export function getStoredSidebarHeaderStyle(): SidebarHeaderStyle {
  try {
    return localStorage.getItem(SIDEBAR_HEADER_KEY) === "user" ? "user" : "app";
  } catch {
    return "app";
  }
}

const SIDEBAR_HEADER_EVENT = "expense-tracker-sidebar-header-style-change";

export function setStoredSidebarHeaderStyle(style: SidebarHeaderStyle) {
  try {
    localStorage.setItem(SIDEBAR_HEADER_KEY, style);
  } catch {
    // ignore - see api.ts's setToken for the same tradeoff
  }
  // AppShell only reads localStorage once, on mount - the browser's
  // own "storage" event doesn't fire in the tab that made the change,
  // so without this, an already-mounted sidebar (e.g. this Settings
  // page's own) wouldn't update until the next navigation remounted
  // it. This makes the switch apply immediately everywhere instead.
  window.dispatchEvent(new CustomEvent<SidebarHeaderStyle>(SIDEBAR_HEADER_EVENT, { detail: style }));
}

/** Subscribes to setStoredSidebarHeaderStyle() calls made anywhere in
 * this tab (see the event note above). Returns an unsubscribe
 * function, meant for a useEffect cleanup. */
export function onSidebarHeaderStyleChange(callback: (style: SidebarHeaderStyle) => void): () => void {
  function handler(e: Event) {
    callback((e as CustomEvent<SidebarHeaderStyle>).detail);
  }
  window.addEventListener(SIDEBAR_HEADER_EVENT, handler);
  return () => window.removeEventListener(SIDEBAR_HEADER_EVENT, handler);
}

/** Which of Income/Expense/Net are toggled off the Dashboard's Trend
 * chart - shared between the chart's own legend (click to toggle) and
 * the Settings page's "Trend chart series" checkboxes, both reading
 * and writing the same key so either one stays in sync with the
 * other (via a fresh mount - Settings and the Dashboard are separate
 * pages, never mounted at once, so no live-update event is needed
 * here the way SIDEBAR_HEADER_EVENT is for same-page changes). */
export function getStoredTrendHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(TREND_HIDDEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function setStoredTrendHidden(hidden: Set<string>) {
  try {
    localStorage.setItem(TREND_HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    // ignore - see api.ts's setToken for the same tradeoff
  }
}

/** Inline script source, run from <head> before paint (see layout.tsx)
 * so the page never flashes the wrong theme/accent color while React
 * hydrates. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    // Unset (first-ever visit) and 'system' both resolve the same way -
    // via the OS/browser preference - only an explicit 'light'/'dark'
    // choice skips that lookup.
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    var accent = localStorage.getItem('${ACCENT_KEY}');
    if (accent) document.documentElement.style.setProperty('--accent', accent);
  } catch (e) {}
})();
`;
