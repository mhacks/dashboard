import type { MetadataRoute } from "next";

import { EVENT } from "@/lib/config/event";

// Was app/manifest.json — a route handler instead, so the installed-app name
// follows lib/config/event.ts rather than needing its own edit each year.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: EVENT.name,
    short_name: EVENT.name,
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone",
  };
}
