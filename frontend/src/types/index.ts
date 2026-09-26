// Shapes returned by the Django/Ninja API (backend/apps/core/api.py).
// Keep these in sync with backend/apps/core/schemas.py by hand -
// there's no schema generation wired up (yet) to derive them
// automatically.

export interface Category {
  id: number;
  name: string;
  color: string;
  type: "expense" | "income";
  icon: string;
  budget_limit: string | null;
  // Only populated by GET /api/categories (see backend's resolver) -
  // absent/0 from the create/update responses.
  spent_this_month: number;
}

export interface Transaction {
  id: number;
  type: "expense" | "income";
  amount: string;
  category: number | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  date: string; // YYYY-MM-DD
  note: string | null;
}

export interface Asset {
  id: number;
  name: string;
  asset_type: "bank" | "cash" | "investment" | "property" | "vehicle" | "other";
  value: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface BreakdownItem {
  name: string;
  amount: number;
  color: string;
  icon: string;
}

export interface BudgetProgressItem {
  name: string;
  color: string;
  icon: string;
  spent: number;
  limit: number;
  pct: number;
  over: boolean;
}

export interface Summary {
  month: string;
  income: number;
  expense: number;
  net: number;
  net_worth: number;
  breakdown: BreakdownItem[];
  budget_progress: BudgetProgressItem[];
  mini_trend: MonthlyTotal[];
  trend_label: string;
}

export interface Profile {
  username: string;
  picture: string | null;
  favicon: string | null;
  theme: "dark" | "light" | "system";
  language: string;
  full_name: string;
  email: string;
  phone: string;
}

export interface MonthlyTotal {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface TopCategory {
  name: string;
  color: string;
  icon: string;
  total: number;
}

export interface ReportsData {
  monthly_totals: MonthlyTotal[];
  top_categories: TopCategory[];
}

export interface SavedSearch {
  id: number;
  page: string;
  name: string;
  month: string;
  date_from: string;
  date_to: string;
  category_ids: string;
  group_by: string;
  fold_groups: boolean;
  is_default: boolean;
}

export const ASSET_TYPES: { value: Asset["asset_type"]; label: string }[] = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other" },
];
