import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saas/config", "@saas/db"],
};

export default nextConfig;
