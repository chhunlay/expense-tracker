import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
