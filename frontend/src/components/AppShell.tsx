"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { API_BASE_URL, apiFetch, getToken } from "@/lib/api";
import { logout } from "@/lib/auth";
import { onProfileUpdate } from "@/lib/profile";
import { getStoredSidebarHeaderStyle, onSidebarHeaderStyleChange, SidebarHeaderStyle } from "@/lib/theme";
import { Profile } from "@/types";
import ThemeToggle from "./ThemeToggle";
import {
  AssetsIcon,
  CategoriesIcon,
  DashboardIcon,
  LogoutIcon,
  ReportsIcon,
  SettingsIcon,
  TransactionsIcon,
} from "./icons";

// Same layout as the old Django base.html: a fixed left sidebar on
// desktop (md+), a pill nav under a mobile header below that, grouped
// into the same sections (a plain nav list, then an "Accounting"
// header above Assets, then Settings on its own).
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
      { href: "/transactions", label: "Transactions", Icon: TransactionsIcon },
      { href: "/categories", label: "Categories", Icon: CategoriesIcon },
      { href: "/reports", label: "Reports", Icon: ReportsIcon },
    ],
  },
  {
    label: "Accounting",
    items: [{ href: "/assets", label: "Assets", Icon: AssetsIcon }],
  },
  {
    label: null,
    items: [{ href: "/settings", label: "Settings", Icon: SettingsIcon }],
  },
];

/** The sidebar/mobile-header brand block - either the app logo + name
 * (with the username as a small subtitle) or, when the user has
 * picked "User greeting" in Settings, the user's own avatar with the
 * exact same title/subtitle styling - "Welcome" where "Expense
 * Tracker" was, the username where its subtitle was - just swapped
 * for a personal greeting instead of the app name. Shared between the
 * desktop sidebar and the mobile header so the two can't drift out of
 * sync. */
function SidebarBrand({
  style,
  profile,
  displayName,
  titleSize,
}: {
  style: SidebarHeaderStyle;
  profile: Profile | null;
  displayName: string;
  titleSize: "text-base" | "text-lg";
}) {
  if (style === "user") {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
          {profile?.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_BASE_URL}${profile.picture}`} alt="" className="h-full w-full object-cover" />
          ) : (
            profile?.username?.[0]?.toUpperCase() || "?"
          )}
        </div>
        <div className="mt-0.5 min-w-0">
          <h1 className={`${titleSize} font-extrabold tracking-tight`}>Welcome</h1>
          {profile?.username && <p className="text-faint truncate text-xs">{profile.username}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 text-lg shadow-lg shadow-indigo-500/20">
        💰
      </div>
      <div className="mt-0.5 min-w-0">
        <h1 className={`${titleSize} font-extrabold tracking-tight`}>Expense Tracker</h1>
        {displayName && <p className="text-faint truncate text-xs">{displayName}</p>}
      </div>
    </div>
  );
}

/** Wraps every authenticated page: the sidebar/mobile-nav chrome, plus
 * the redirect-to-/login guard the standalone RequireAuth used to do -
 * merged here since every page that needs the shell also needs auth. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Starts false on both server and client so the very first render
  // (and hydration) always produces the same "render nothing yet"
  // output - getToken() reads localStorage, which doesn't exist during
  // SSR, so calling it before mount would make the server and client
  // disagree and trigger a hydration-mismatch warning. (A
  // useSyncExternalStore-based version was tried instead, to avoid the
  // effect+setState pattern below entirely, but it broke re-checking
  // the token on a hard reload/direct URL visit - reverted.)
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [headerStyle, setHeaderStyle] = useState<SidebarHeaderStyle>("app");

  useEffect(() => {
    // This effect exists specifically to read an external system
    // (localStorage) that doesn't exist during SSR; there's no way to
    // know its value before mount, so this can't move to render.
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(true);
    setHeaderStyle(getStoredSidebarHeaderStyle());
    apiFetch<Profile>("/api/profile")
      .then(setProfile)
      .catch(() => {
        // Not worth surfacing an error banner for - the header/subtitle
        // just stays off and the rest of the shell still works fine.
      });
  }, [router]);

  useEffect(() => onSidebarHeaderStyleChange(setHeaderStyle), []);
  useEffect(() => onProfileUpdate(setProfile), []);

  if (!checked) return null;

  const displayName = profile?.full_name || profile?.email || profile?.username || "";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sidebar hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-shrink-0 md:flex-col md:self-start md:p-5">
        <div className="mb-4">
          <SidebarBrand style={headerStyle} profile={profile} displayName={displayName} titleSize="text-base" />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i}>
              {section.label && (
                <p className="text-faint mb-1 mt-4 px-3 text-[0.7rem] font-bold uppercase tracking-wider first:mt-0">
                  {section.label}
                </p>
              )}
              {section.items.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`sidebar-link flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    pathname === href ? "active" : ""
                  }`}
                >
                  <Icon /> {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-link flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold"
          >
            <LogoutIcon /> Log out
          </button>
          <ThemeToggle />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 md:hidden">
            <div className="mb-4 flex items-center justify-between gap-2">
              <SidebarBrand style={headerStyle} profile={profile} displayName={displayName} titleSize="text-lg" />
              <ThemeToggle />
            </div>
            <nav className="glass-card flex gap-1 overflow-x-auto rounded-2xl p-1.5">
              {NAV_SECTIONS.flatMap((s) => s.items).map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
                    pathname === href ? "active" : ""
                  }`}
                >
                  {label}
                </Link>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                className="nav-link flex-shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold"
              >
                Log out
              </button>
            </nav>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
