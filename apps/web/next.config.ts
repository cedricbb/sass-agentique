import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saas/config", "@saas/db", "@saas/services"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
