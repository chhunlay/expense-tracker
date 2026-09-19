import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Same font the old Django templates used (Google Fonts Inter,
// weights 400-800).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Personal expense tracker - Next.js frontend for the Django API",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      // The inline script below sets data-theme before React hydrates,
      // deliberately making the client's <html> differ from the
      // server-rendered one - this tells React that's expected instead
      // of logging a hydration-mismatch warning for it.
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme before paint so there's no flash of the
            wrong theme while React hydrates - see lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
