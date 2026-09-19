import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev-mode badge (route info / build activity) isn't
  // part of this app's UI - off in dev so it doesn't sit in the corner
  // over the sidebar's Log out button.
  devIndicators: false,
};

export default nextConfig;
