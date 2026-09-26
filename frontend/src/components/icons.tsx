// Same plain stroke-only outline icons the old Django templates used
// (expenses/templatetags/expenses_extras.py's icon_svg filter, now
// removed along with the rest of the HTML templates) - reproduced here
// as React components so the Next.js UI keeps the same look.
import { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
      {...props}
    />
  );
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Icon>
  );
}

export function TransactionsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1z" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </Icon>
  );
}

export function CategoriesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.25" />
    </Icon>
  );
}

export function ReportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </Icon>
  );
}

export function AssetsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </Icon>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  );
}

export function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon width={26} height={26} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12h2" />
    </Icon>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Icon>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Icon>
  );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <polyline points="6 9 12 15 18 9" />
    </Icon>
  );
}

export function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4" />
    </Icon>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Icon>
  );
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </Icon>
  );
}

export function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon width={16} height={16} {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Icon>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon width={14} height={14} {...props}>
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="m22 6-10 7L2 6" />
    </Icon>
  );
}

export function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon width={14} height={14} {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </Icon>
  );
}

// Solid-filled (not stroke-outline like the rest of this file) - used
// by ThemeToggle's pill switch, replacing the plain moon/sun emoji it
// used before, to match the reference icon style the user shared.
function FilledIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0"
      aria-hidden="true"
      {...props}
    />
  );
}

// The app's own mark (a segmented pie/donut ring around a solid
// coin) - recreated from the reference the user shared, replacing the
// generic 💰 emoji previously used for the sidebar logo and the
// Settings favicon card's default placeholder. Single-tone
// (currentColor), like the rest of this file's icons, so it stays
// legible tinted any color - unlike the standalone two-tone black/
// white version at src/app/icon.svg (the actual browser tab icon,
// Next.js's App Router convention), which isn't currentColor-tinted
// and can safely add a white "$" cutout on the black coin. Keep the
// ring/coin path in sync between the two if it ever changes.
export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FilledIcon width={20} height={20} {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 2.05a10 10 0 0 0-3.518 18.635l1.554-3.226A6 6 0 0 1 11 6.083V2.05Zm2 0v4.033a6 6 0 0 1 3.518 1.409l3.15-2.522A9.98 9.98 0 0 0 13 2.05Zm7.94 4.522-3.15 2.522A5.98 5.98 0 0 1 18 12c0 1.264-.402 2.434-1.086 3.39l3.237 2.148A9.96 9.96 0 0 0 22 12a9.96 9.96 0 0 0-1.06-4.478v-.95ZM16.086 16.39a5.98 5.98 0 0 1-3.32 1.518l.234 3.987a9.98 9.98 0 0 0 6.323-3.357l-3.237-2.148ZM10.966 21.895l-.234-3.987a6.02 6.02 0 0 1-2.696-1.05l-1.554 3.226a9.96 9.96 0 0 0 4.484 1.81ZM12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
      />
    </FilledIcon>
  );
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FilledIcon {...props}>
      <path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </FilledIcon>
  );
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FilledIcon {...props}>
      <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
    </FilledIcon>
  );
}

export function GroupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <polygon points="12 2 21 7.5 12 13 3 7.5 12 2" />
      <polyline points="3 12 12 17.5 21 12" />
      <polyline points="3 16.5 12 22 21 16.5" />
    </Icon>
  );
}

export function StarIcon({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  const points =
    "12 2.5 15.09 8.76 22 9.77 17 14.64 18.18 21.52 12 18.27 5.82 21.52 7 14.64 2 9.77 8.91 8.76 12 2.5";
  return filled ? (
    <FilledIcon {...props}>
      <polygon points={points} />
    </FilledIcon>
  ) : (
    <Icon {...props}>
      <polygon points={points} />
    </Icon>
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Icon>
  );
}

// Category icons for the dashboard's Budgets list - same plain
// stroke-only outline style as the sidebar icons above (currentColor,
// no fixed hue) rather than platform emoji, so they inherit the
// theme/text color instead of carrying their own.
export function FoodIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 2v7a2 2 0 0 0 2 2v11" />
      <path d="M7 2v6M11 2v6" />
      <path d="M17 2c-1.5 1.5-2 3.5-2 6a3 3 0 0 0 3 3v11" />
    </Icon>
  );
}

export function GroceriesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 4h2l1.68 10.39A2 2 0 0 0 9.65 16h7.7a2 2 0 0 0 1.97-1.61L21 8H6" />
      <circle cx="10" cy="20" r="1.25" />
      <circle cx="17" cy="20" r="1.25" />
    </Icon>
  );
}

export function TransportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 15h18M5 15l1.5-6a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 15" />
      <path d="M3 15v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3" />
      <circle cx="7.5" cy="15" r="1.25" />
      <circle cx="16.5" cy="15" r="1.25" />
    </Icon>
  );
}

export function RentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
      <path d="M10 21v-6h4v6" />
    </Icon>
  );
}

export function SubscriptionsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 0 1 15.4-6.36L21 8" />
      <polyline points="21 3 21 8 16 8" />
      <path d="M21 12a9 9 0 0 1-15.4 6.36L3 16" />
      <polyline points="3 21 3 16 8 16" />
    </Icon>
  );
}

export function BillsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <polygon points="13 2 4 14 11 14 10 22 20 9 13 9 13 2" />
    </Icon>
  );
}

export function HealthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.4 4.4 0 0 1 8-2.5 4.4 4.4 0 0 1 9.6.5Z" />
      <path d="M9 10h2l1-2 2 4 1-2h2" />
    </Icon>
  );
}

export function ShoppingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 8h12l1 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Icon>
  );
}

export function EntertainmentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polygon points="10 9 16 12 10 15 10 9" />
    </Icon>
  );
}

export function TagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.25" />
    </Icon>
  );
}

export function TravelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-3 2v1.5l4.5-1.5 4.5 1.5V21l-3-2v-5.5z" />
    </Icon>
  );
}

export function EducationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2 9 12 4l10 5-10 5-10-5Z" />
      <path d="M6 11.5V17c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5" />
      <path d="M22 9v6" />
    </Icon>
  );
}

export function GiftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="9" width="18" height="4" rx="1" />
      <path d="M4 13h16v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <line x1="12" y1="9" x2="12" y2="21" />
      <path d="M12 9C9 9 7.5 7.5 7.5 6a2.5 2.5 0 0 1 5 0v3ZM12 9c3 0 4.5-1.5 4.5-3a2.5 2.5 0 0 0-5 0v3Z" />
    </Icon>
  );
}

export function CashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="10" x2="6" y2="10.01" />
      <line x1="18" y1="14" x2="18" y2="14.01" />
    </Icon>
  );
}

export function PetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="10.5" r="1.75" />
      <circle cx="10" cy="7" r="1.75" />
      <circle cx="14" cy="7" r="1.75" />
      <circle cx="18.5" cy="10.5" r="1.75" />
      <path d="M8 14c0-2 1.5-3 4-3s4 1 4 3c0 2.5-2 4.5-4 4.5S8 16.5 8 14Z" />
    </Icon>
  );
}
