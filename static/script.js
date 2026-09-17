// ---------- Theme (same scheme as video-downloader, its own key) ----------
// Two toggle buttons exist (sidebar for md+, header for mobile - only one
// is ever visible at a time via CSS), so every icon/id pair gets updated
// and listened to together.
const THEME_KEY = 'expense-tracker-theme';
const html = document.documentElement;
const themeIcons = [document.getElementById('themeIcon'), document.getElementById('themeIconMobile')].filter(Boolean);

function applyTheme(theme) {
    const isLight = theme === 'light';
    html.setAttribute('data-theme', isLight ? 'light' : 'dark');
    themeIcons.forEach((icon) => { icon.textContent = isLight ? '☀️' : '🌙'; });
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

[document.getElementById('themeToggle'), document.getElementById('themeToggleMobile')].filter(Boolean).forEach((btn) => {
    btn.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
});

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

// ---------- Hide/show sensitive amounts (dashboard Income + Net) ----------
// One toggle masks both at once; the real formatted amount is kept in
// data-amount so un-hiding doesn't need a round trip to the server.
// State persists in localStorage, same pattern as the theme, so it stays
// hidden across page loads/navigation instead of resetting every visit.
const HIDE_AMOUNTS_KEY = 'expense-tracker-hide-amounts';
const amountToggle = document.getElementById('amountToggle');
const amountToggleIcon = document.getElementById('amountToggleIcon');
const hideableAmounts = document.querySelectorAll('.hideable-amount');

function applyAmountVisibility(hidden) {
    hideableAmounts.forEach((el) => {
        el.textContent = hidden ? '$••••' : el.dataset.amount;
    });
    if (amountToggleIcon) amountToggleIcon.textContent = hidden ? '🙈' : '👁️';
}

function getStoredHideAmounts() {
    try {
        return localStorage.getItem(HIDE_AMOUNTS_KEY) === '1';
    } catch (e) {
        return false;
    }
}

let amountsHidden = getStoredHideAmounts();
if (hideableAmounts.length) applyAmountVisibility(amountsHidden);

if (amountToggle) {
    amountToggle.addEventListener('click', () => {
        amountsHidden = !amountsHidden;
        applyAmountVisibility(amountsHidden);
        try { localStorage.setItem(HIDE_AMOUNTS_KEY, amountsHidden ? '1' : '0'); } catch (e) {}
    });
}
