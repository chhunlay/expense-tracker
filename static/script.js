// ---------- Theme (same scheme as video-downloader, its own key) ----------
const THEME_KEY = 'expense-tracker-theme';
const html = document.documentElement;
const themeIcon = document.getElementById('themeIcon');

function applyTheme(theme) {
    if (theme === 'light') {
        html.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        html.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

function getStoredTheme() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch (e) {
        return null;
    }
}

const systemPrefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
applyTheme(getStoredTheme() || (systemPrefersLight ? 'light' : 'dark'));

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
}

// ---------- Flash messages auto-dismiss ----------
document.querySelectorAll('.flash').forEach((el) => {
    setTimeout(() => el.classList.add('hidden'), 4000);
});

// ---------- Apply templated inline styles ----------
// Category-color dots and budget progress bars need a per-row value from
// the server (a hex color, a percent). Putting that straight into a
// style="..." attribute (e.g. style="background:{{ b.color }}") trips
// the editor's embedded CSS checker, which doesn't know Jinja and reads
// the literal "{{" as invalid CSS. The value travels as a data-*
// attribute instead (not CSS-checked) and is applied as a real inline
// style here at runtime - same rendered result, no template syntax
// anywhere near a style attribute.
document.querySelectorAll('[data-color]').forEach((el) => {
    el.style.background = el.dataset.color;
});
document.querySelectorAll('[data-width]').forEach((el) => {
    el.style.width = el.dataset.width + '%';
});
