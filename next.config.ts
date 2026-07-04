import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["172.16.0.49"],
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "logged-assets.s3.amazonaws.com",
        pathname: "/trust-badge/**",
      },
    ],
  },
};

export default nextConfig;
