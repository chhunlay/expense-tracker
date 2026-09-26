import { SVGProps } from "react";

import {
  BillsIcon,
  CashIcon,
  EducationIcon,
  EntertainmentIcon,
  FoodIcon,
  GiftIcon,
  GroceriesIcon,
  HealthIcon,
  PetIcon,
  RentIcon,
  ShoppingIcon,
  SubscriptionsIcon,
  TagIcon,
  TransportIcon,
  TravelIcon,
} from "@/components/icons";

// Keys match Category.ICON_CHOICES (backend/apps/core/models.py) - a
// category's `icon` field stores one of these keys, picked from the
// IconPicker on the Categories page, so it stays a fixed set instead of
// freeform text. CategoryIcon below is what actually renders one.
export const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "groceries", label: "Groceries" },
  { key: "transport", label: "Transport" },
  { key: "home", label: "Home" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "bills", label: "Bills" },
  { key: "health", label: "Health" },
  { key: "shopping", label: "Shopping" },
  { key: "entertainment", label: "Entertainment" },
  { key: "travel", label: "Travel" },
  { key: "education", label: "Education" },
  { key: "gift", label: "Gift" },
  { key: "cash", label: "Cash" },
  { key: "pet", label: "Pet" },
  { key: "tag", label: "Other" },
];

// Renders a category's icon by key with a plain switch, rather than
// looking up a component reference and using it as a JSX tag - the
// project's react-hooks/static-components lint rule flags that pattern
// as "creating a component during render", even though the lookup here
// is stable, so each icon is referenced directly by its own JSX tag.
export function CategoryIcon({ icon, ...props }: { icon: string } & SVGProps<SVGSVGElement>) {
  switch (icon) {
    case "food":
      return <FoodIcon {...props} />;
    case "groceries":
      return <GroceriesIcon {...props} />;
    case "transport":
      return <TransportIcon {...props} />;
    case "home":
      return <RentIcon {...props} />;
    case "subscriptions":
      return <SubscriptionsIcon {...props} />;
    case "bills":
      return <BillsIcon {...props} />;
    case "health":
      return <HealthIcon {...props} />;
    case "shopping":
      return <ShoppingIcon {...props} />;
    case "entertainment":
      return <EntertainmentIcon {...props} />;
    case "travel":
      return <TravelIcon {...props} />;
    case "education":
      return <EducationIcon {...props} />;
    case "gift":
      return <GiftIcon {...props} />;
    case "cash":
      return <CashIcon {...props} />;
    case "pet":
      return <PetIcon {...props} />;
    default:
      return <TagIcon {...props} />;
  }
}
