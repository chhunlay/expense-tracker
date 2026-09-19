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
