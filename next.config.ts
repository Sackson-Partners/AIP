import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config silences the webpack/turbopack config mismatch warning
  // while allowing Turbopack (the Next.js 16 default bundler) to run normally.
  turbopack: {},
};

export default nextConfig;
