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

// ---------- Custom date picker ----------
// Chrome's native <input type="date"> calendar popup can ignore the
// page's color-scheme entirely on some versions/platforms (it appears
// to follow the OS-level system appearance for that specific rich
// overlay rather than the page's own declared theme) - a real browser
// limitation, not something fixable from our CSS. This is a small
// self-built replacement using plain themed DOM/CSS instead, so it
// always matches regardless of what the browser's native widget does.
// A hidden input still carries the real "YYYY-MM-DD" value the server
// expects; the visible button is just a themed trigger + display.
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function initDatePicker(root) {
    const trigger = root.querySelector('[data-dp-trigger]');
    const display = root.querySelector('[data-dp-display]');
    const valueInput = root.querySelector('[data-dp-value]');
    const panel = root.querySelector('[data-dp-panel]');
    if (!trigger || !display || !valueInput || !panel) return;

    function parseValue() {
        const v = valueInput.value;
        if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const [y, m, d] = v.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        return new Date();
    }

    function formatValue(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDisplay(date) {
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    let selected = parseValue();
    let viewYear = selected.getFullYear();
    let viewMonth = selected.getMonth();
    let viewMode = 'days'; // 'days' | 'months' - clicking the month/year
                            // label switches to a month-grid for jumping
                            // straight to any month, like the old native
                            // picker's own month/year dropdown did.

    // Exposed so the modal-reset flow (below) can re-sync the visible
    // display text after form.reset() silently restores the hidden
    // input's value without touching this button's own text content.
    root._dpSyncFromValue = () => {
        selected = parseValue();
        viewYear = selected.getFullYear();
        viewMonth = selected.getMonth();
        viewMode = 'days';
        display.textContent = formatDisplay(selected);
    };
    root._dpSyncFromValue();

    function render() {
        if (viewMode === 'months') {
            const months = MONTH_NAMES.map((name, i) => {
                const isCurrent = i === viewMonth;
                return `<button type="button" class="dp-month${isCurrent ? ' dp-day-selected' : ''}" data-dp-month="${i}">${name.slice(0, 3)}</button>`;
            });
            panel.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <button type="button" class="dp-nav" data-dp-year-prev aria-label="Previous year">&lsaquo;</button>
                    <button type="button" class="font-semibold text-sm" data-dp-month-toggle>${viewYear}</button>
                    <button type="button" class="dp-nav" data-dp-year-next aria-label="Next year">&rsaquo;</button>
                </div>
                <div class="grid grid-cols-3 gap-1.5 text-center text-sm">${months.join('')}</div>
            `;
            return;
        }

        const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cells = [];
        for (let i = 0; i < firstWeekday; i++) cells.push('<span></span>');
        for (let d = 1; d <= daysInMonth; d++) {
            const cellDate = new Date(viewYear, viewMonth, d);
            const isSelected = cellDate.getTime() === new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()).getTime();
            const isToday = cellDate.getTime() === today.getTime();
            const cls = 'dp-day' + (isSelected ? ' dp-day-selected' : '') + (isToday && !isSelected ? ' dp-day-today' : '');
            cells.push(`<button type="button" class="${cls}" data-dp-day="${d}">${d}</button>`);
        }

        panel.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <button type="button" class="dp-nav" data-dp-prev aria-label="Previous month">&lsaquo;</button>
                <button type="button" class="font-semibold text-sm" data-dp-month-toggle>${MONTH_NAMES[viewMonth]} ${viewYear}</button>
                <button type="button" class="dp-nav" data-dp-next aria-label="Next month">&rsaquo;</button>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-xs text-faint mb-1">
                ${WEEKDAY_LABELS.map((w) => `<span>${w}</span>`).join('')}
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-sm">${cells.join('')}</div>
            <button type="button" class="dp-today-btn" data-dp-today>Today</button>
        `;
    }

    // One delegated listener on the panel itself, attached once (not
    // re-attached on every render() - render() replaces the buttons
    // inside via innerHTML, which would detach any listener bound
    // directly to them). Also the fix for a real bug this caught: a
    // per-button listener that calls render() replaces its own button
    // mid-click, so by the time the click event bubbles up to the
    // document-level "close on outside click" listener below,
    // e.target is a detached node that root.contains() no longer
    // recognizes as inside the panel - incorrectly closing it on every
    // Prev/Next click. stopPropagation() here stops the event before
    // it can reach that listener at all.
    panel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('[data-dp-month-toggle]')) {
            viewMode = viewMode === 'days' ? 'months' : 'days';
            render();
        } else if (e.target.closest('[data-dp-month]')) {
            viewMonth = Number(e.target.closest('[data-dp-month]').dataset.dpMonth);
            viewMode = 'days';
            render();
        } else if (e.target.closest('[data-dp-year-prev]')) {
            viewYear -= 1;
            render();
        } else if (e.target.closest('[data-dp-year-next]')) {
            viewYear += 1;
            render();
        } else if (e.target.closest('[data-dp-prev]')) {
            viewMonth -= 1;
            if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
            render();
        } else if (e.target.closest('[data-dp-next]')) {
            viewMonth += 1;
            if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
            render();
        } else if (e.target.closest('[data-dp-today]')) {
            selected = new Date();
            viewYear = selected.getFullYear();
            viewMonth = selected.getMonth();
            viewMode = 'days';
            commit();
        } else {
            const dayBtn = e.target.closest('[data-dp-day]');
            if (dayBtn) {
                selected = new Date(viewYear, viewMonth, Number(dayBtn.dataset.dpDay));
                commit();
            }
        }
    });

    function commit() {
        valueInput.value = formatValue(selected);
        display.textContent = formatDisplay(selected);
        render();
        panel.classList.add('hidden');
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = panel.classList.contains('hidden');
        document.querySelectorAll('[data-dp-panel]').forEach((p) => p.classList.add('hidden'));
        if (wasHidden) {
            root._dpSyncFromValue();
            render();
            panel.classList.remove('hidden');
        }
    });
}

document.querySelectorAll('[data-datepicker]').forEach(initDatePicker);

document.addEventListener('click', (e) => {
    document.querySelectorAll('[data-datepicker]').forEach((root) => {
        if (!root.contains(e.target)) {
            const panel = root.querySelector('[data-dp-panel]');
            if (panel) panel.classList.add('hidden');
        }
    });
});

// ---------- Generic <dialog> modal helper ----------
// Shared by every popup (Add transaction on transactions.html, Add
// category on categories.html, ...) instead of each wiring up its own
// copy. Native <dialog> gives focus trapping, Escape-to-close, and a
// ::backdrop for free; this adds the things it doesn't: resetting any
// leftover input (including re-syncing any date picker's display text,
// which form.reset() silently restores the underlying value for but
// doesn't touch) from a previous open-then-cancel before showing it
// again, and closing on a backdrop click (a click lands on the <dialog>
// element itself, not any child, when it's on the ::backdrop - the
// standard way to detect that for a native dialog).
function openModal(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    const form = dialog.querySelector('form');
    if (form) form.reset();
    dialog.querySelectorAll('[data-datepicker]').forEach((root) => {
        if (root._dpSyncFromValue) root._dpSyncFromValue();
    });
    dialog.showModal();
}
document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });
});
