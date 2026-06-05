import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saas/config", "@saas/db", "@saas/services", "@saas/workflows"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
