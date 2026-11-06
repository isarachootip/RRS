import type { NextConfig } from "next";

const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";

const config: NextConfig = {
  reactStrictMode: true,
  // lint รันแยกด้วย pnpm lint ที่ root
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${internalApiUrl}/health`,
      },
    ];
  },
};

export default config;
