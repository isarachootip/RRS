import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // lint รันแยกด้วย pnpm lint ที่ root
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default config;
