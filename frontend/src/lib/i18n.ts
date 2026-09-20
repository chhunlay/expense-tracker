// A minimal client-side i18n system for the Next.js frontend. The
// Settings page's Language picker used to only PATCH profile.language
// on the backend - nothing ever read that value to actually change
// any rendered text, so switching languages visibly did nothing. This
// gives it something real to do.
//
// The Khmer strings below are carried over from the original Django
// version's gettext catalog (backend/locale/km/LC_MESSAGES/django.po),
// which covered the app's core navigation and common actions before
// the Next.js rewrite - reused here as the source of truth rather than
// re-translating from scratch. Newer features added since that
// version (Favicon, Accent color, Sidebar header, Trend chart series,
// Analytics stats, etc.) aren't in that catalog and aren't covered
// here yet; they fall back to their English text via t()'s default.
import { useEffect, useState } from "react";

export type Language = "en" | "km";

const LANGUAGE_KEY = "expense-tracker-language";

// Keyed by the English string itself, which doubles as the fallback
// for both English and any key not yet translated - no separate `en`
// dictionary needed.
const km: Record<string, string> = {
  Dashboard: "ផ្ទាំងគ្រប់គ្រង",
  Transactions: "ប្រតិបត្តិការ",
  Categories: "ប្រភេទ",
  Reports: "របាយការណ៍",
  Accounting: "គណនេយ្យ",
  Assets: "ទ្រព្យសកម្ម",
  Settings: "ការកំណត់",
  "Net worth": "តម្លៃសុទ្ធ",
  Add: "បន្ថែម",
  "Note (optional)": "កំណត់ចំណាំ (មិនចាំបាច់)",
  "Delete this asset?": "លុបទ្រព្យសកម្មនេះ?",
  Delete: "លុប",
  Save: "រក្សាទុក",
  "No assets yet. Add your first one.": "មិនទាន់មានទ្រព្យសកម្មទេ។ បន្ថែមមួយដំបូងរបស់អ្នក។",
  "Add an asset": "បន្ថែមទ្រព្យសកម្ម",
  Name: "ឈ្មោះ",
  "e.g. Savings account": "ឧទាហរណ៍៖ គណនីសន្សំ",
  Type: "ប្រភេទ",
  "Current value": "តម្លៃបច្ចុប្បន្ន",
  Cancel: "បោះបង់",
  "Add asset": "បន្ថែមទ្រព្យសកម្ម",
  "Log out": "ចាកចេញ",
  "this month": "ខែនេះ",
  "Monthly budget (optional)": "ថវិកាប្រចាំខែ (មិនចាំបាច់)",
  "Delete this category? Its past transactions become Uncategorized.":
    "លុបប្រភេទនេះ? ប្រតិបត្តិការមុនៗនឹងក្លាយជាគ្មានប្រភេទ។",
  "Add a category": "បន្ថែមប្រភេទ",
  "Name & color": "ឈ្មោះ និងពណ៌",
  "Category name": "ឈ្មោះប្រភេទ",
  "Add category": "បន្ថែមប្រភេទ",
  Prev: "មុន",
  Next: "បន្ទាប់",
  Overview: "ទិដ្ឋភាពទូទៅ",
  "Show or hide income and net amounts": "បង្ហាញ ឬលាក់ចំនួនប្រាក់ចំណូល និងចំណូលសុទ្ធ",
  Income: "ប្រាក់ចំណូល",
  Expenses: "ចំណាយ",
  Net: "សុទ្ធ",
  "Quick add": "បន្ថែមរហ័ស",
  "Where it went": "កន្លែងដែលវាបានចំណាយ",
  "No expenses logged this month yet.": "មិនទាន់មានការកត់ត្រាចំណាយក្នុងខែនេះទេ។",
  Budgets: "ថវិកា",
  Recent: "ថ្មីៗ",
  "View all": "មើលទាំងអស់",
  Uncategorized: "គ្មានប្រភេទ",
  "Nothing logged this month yet.": "មិនទាន់មានការកត់ត្រាអ្វីក្នុងខែនេះទេ។",
  "Edit Transaction": "កែសម្រួលប្រតិបត្តិការ",
  "Edit transaction": "កែសម្រួលប្រតិបត្តិការ",
  Expense: "ចំណាយ",
  Amount: "ចំនួនទឹកប្រាក់",
  Category: "ប្រភេទ",
  Date: "កាលបរិច្ឆេទ",
  "Delete this transaction?": "លុបប្រតិបត្តិការនេះ?",
  Import: "នាំចូល",
  "Import transactions": "នាំចូលប្រតិបត្តិការ",
  "Export CSV": "នាំចេញ CSV",
  or: "ឬ",
  "Export XLSX": "នាំចេញ XLSX",
  "Log in": "ចូល",
  Username: "ឈ្មោះអ្នកប្រើប្រាស់",
  Password: "ពាក្យសម្ងាត់",
  "Incorrect username or password.": "ឈ្មោះអ្នកប្រើប្រាស់ ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។",
  "No account yet?": "មិនទាន់មានគណនីមែនទេ?",
  "Create one": "បង្កើតគណនីថ្មី",
  "Create account": "បង្កើតគណនី",
  "Confirm password": "បញ្ជាក់ពាក្យសម្ងាត់",
  "Already have an account?": "មានគណនីរួចហើយ?",
  "Net trend (last 12 months)": "និន្នាការសុទ្ធ (១២ខែចុងក្រោយ)",
  "Income vs. expenses (last 12 months)": "ប្រាក់ចំណូល និងចំណាយ (១២ខែចុងក្រោយ)",
  "Top categories (last 12 months)": "ប្រភេទកំពូល (១២ខែចុងក្រោយ)",
  "No expenses in this window yet.": "មិនទាន់មានចំណាយក្នុងចន្លោះពេលនេះទេ។",
  "Profile picture": "រូបភាពប្រូហ្វាល់",
  Upload: "ផ្ទុកឡើង",
  Language: "ភាសា",
  Export: "នាំចេញ",
  "Add transaction": "បន្ថែមប្រតិបត្តិការ",
  "What was it for?": "សម្រាប់អ្វី?",
  Filter: "តម្រង",
  Clear: "សម្អាត",
  Note: "កំណត់ចំណាំ",
  Edit: "កែសម្រួល",
  "No transactions match this filter.": "គ្មានប្រតិបត្តិការត្រូវនឹងតម្រងនេះទេ។",
  "Welcome! Your account is ready.": "សូមស្វាគមន៍! គណនីរបស់អ្នករួចរាល់ហើយ។",
  "Profile picture updated": "បានធ្វើបច្ចុប្បន្នភាពរូបភាពប្រូហ្វាល់",
  "Language updated": "បានធ្វើបច្ចុប្បន្នភាពភាសា",
  "Transaction added": "បានបន្ថែមប្រតិបត្តិការ",
  "Transaction updated": "បានធ្វើបច្ចុប្បន្នភាពប្រតិបត្តិការ",
  "Transaction deleted": "បានលុបប្រតិបត្តិការ",
  "Category added": "បានបន្ថែមប្រភេទ",
  "Category updated": "បានធ្វើបច្ចុប្បន្នភាពប្រភេទ",
  "Category deleted": "បានលុបប្រភេទ",
  "Asset added": "បានបន្ថែមទ្រព្យសកម្ម",
  "Asset updated": "បានធ្វើបច្ចុប្បន្នភាពទ្រព្យសកម្ម",
  "Asset deleted": "បានលុបទ្រព្យសកម្ម",
  "This Week": "សប្តាហ៍នេះ",
  "This Month": "ខែនេះ",
  "Last Month": "ខែមុន",
};

const dictionaries: Record<Language, Record<string, string>> = { en: {}, km };

export function getStoredLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "km" ? "km" : "en";
  } catch {
    return "en";
  }
}

const LANGUAGE_EVENT = "expense-tracker-language-change";

/** Persists the language and broadcasts the change so every mounted
 * page picks it up immediately - same same-tab-live-update need as
 * ACCENT_KEY/SIDEBAR_HEADER_EVENT in lib/theme.ts. */
export function setStoredLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // ignore - see api.ts's setToken for the same tradeoff
  }
  window.dispatchEvent(new CustomEvent<Language>(LANGUAGE_EVENT, { detail: language }));
}

export function onLanguageChange(callback: (language: Language) => void): () => void {
  function handler(e: Event) {
    callback((e as CustomEvent<Language>).detail);
  }
  window.addEventListener(LANGUAGE_EVENT, handler);
  return () => window.removeEventListener(LANGUAGE_EVENT, handler);
}

/** Reads the active language (localStorage, live-updated) and returns
 * a `t()` translator - falls back to the English text itself when a
 * string isn't in the active dictionary yet, so untranslated (newer)
 * UI never renders blank. */
export function useTranslation() {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    // Reads an external system (localStorage) not available during
    // SSR - see AppShell's auth-check effect for the same pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(getStoredLanguage());
    return onLanguageChange(setLanguage);
  }, []);

  function t(text: string): string {
    return dictionaries[language][text] ?? text;
  }

  return { language, t };
}
