import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["172.16.0.49"],
  output: 'standalone',
};

export default nextConfig;
