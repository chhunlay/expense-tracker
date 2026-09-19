// Shapes returned by the Django REST Framework API (expense-tracker/expenses/api/).
// Keep these in sync with expenses/api/serializers.py by hand - there's
// no schema generation wired up (yet) to derive them automatically.

export interface Category {
  id: number;
  name: string;
  color: string;
  budget_limit: string | null;
}

export interface Transaction {
  id: number;
  type: "expense" | "income";
  amount: string;
  category: number | null;
  category_name: string | null;
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

export interface Summary {
  month: string;
  income: number;
  expense: number;
  net: number;
  net_worth: number;
}

export interface Profile {
  username: string;
  picture: string | null;
  theme: "dark" | "light";
  language: string;
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
  total: number;
}

export interface ReportsData {
  monthly_totals: MonthlyTotal[];
  top_categories: TopCategory[];
}

export const ASSET_TYPES: { value: Asset["asset_type"]; label: string }[] = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other" },
];
