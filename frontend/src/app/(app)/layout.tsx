import AppShell from "@/components/AppShell";

// A route group (the parens don't affect the URL - /dashboard,
// /transactions, etc. are unchanged) so every authenticated page
// shares this one AppShell instance instead of each page mounting its
// own. Before this, every page.tsx wrapped itself in <AppShell>
// directly, so navigating between them fully unmounted and remounted
// the sidebar each time - re-running its auth check, re-fetching the
// profile, and visibly flickering the whole nav, which read as "every
// menu refreshes" when it should only be the page content changing.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
