import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["172.16.0.49", "127.0.0.1"],
  output: "standalone",
  images: {
    // Prefer AVIF, fall back to WebP — smaller payloads at the same visual quality.
    formats: ["image/avif", "image/webp"],
    // Permit lower quality values when passed explicitly on <Image quality={…} />.
    qualities: [20, 30, 40, 50, 60, 75],
    // Cap generated widths — nothing on the site needs 2k/4k full-bleed variants.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 512],
    minimumCacheTTL: 86_400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "logged-assets.s3.amazonaws.com",
        pathname: "/trust-badge/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
