import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saas/config", "@saas/db", "@saas/services"],
};

export default nextConfig;
