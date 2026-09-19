// Same dark/light scheme as the old script.js: a stored preference in
// localStorage, falling back to the OS/browser's prefers-color-scheme
// when nothing's been chosen yet.
const THEME_KEY = "expense-tracker-theme";

export type Theme = "dark" | "light";

export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
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

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Inline script source, run from <head> before paint (see layout.tsx)
 * so the page never flashes the wrong theme while React hydrates. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;
