import type { NextConfig } from "next";

const internalApiUrl = process.env.INTERNAL_API_URL ?? "https://rrs.tamadee.online";

const config: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/api/:path*`,
      },
    ];
  },
};
export default config;
