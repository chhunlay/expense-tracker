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
// One toggle blurs both at once, in place - the real digits stay in the
// DOM (unlike a text-swap mask), a CSS filter just obscures them, same
// look as a banking app's balance-privacy toggle. State persists in
// localStorage, same pattern as the theme, so it stays hidden across
// page loads/navigation instead of resetting every visit.
const HIDE_AMOUNTS_KEY = 'expense-tracker-hide-amounts';
const amountToggle = document.getElementById('amountToggle');
const amountToggleIcon = document.getElementById('amountToggleIcon');
const hideableAmounts = document.querySelectorAll('.hideable-amount');

// Feather-style eye / eye-off icons (stroke, inherits currentColor).
const EYE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

function applyAmountVisibility(hidden) {
    hideableAmounts.forEach((el) => {
        el.classList.toggle('amount-hidden', hidden);
    });
    if (amountToggleIcon) amountToggleIcon.innerHTML = hidden ? EYE_OFF_ICON : EYE_ICON;
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

// ---------- Export dropdown (Transactions page) ----------
// Hover-to-open is pure CSS (#exportMenuWrap:hover in style.css, which
// out-specificities the .hidden class below regardless of its state).
// This only handles the parts CSS can't: click to keep it open on
// touch (where hover never fires), and closing it on an outside click.
const exportMenuBtn = document.getElementById('exportMenuBtn');
const exportMenu = document.getElementById('exportMenu');
if (exportMenuBtn && exportMenu) {
    exportMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!exportMenu.classList.contains('hidden') && !exportMenu.contains(e.target) && e.target !== exportMenuBtn) {
            exportMenu.classList.add('hidden');
        }
    });
}
