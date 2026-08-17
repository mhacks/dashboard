import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { DEFAULT_BACKDROP, backdropDef } from "@/lib/pass/backdrops";

/*
  The one selectable face the dashboard's root layout does not already load.
  Declared here so only this route pays for it, and here rather than in
  lib/pass/fonts.ts so that module stays plain data the server-side prefill
  can import without dragging in the font loader.

  No `weight` — it is a variable font, so this is one woff2 covering 300–700
  instead of the five static instances an explicit weight array would emit.
*/
import { EVENT } from "@/lib/config/event";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `Boarding Pass · ${EVENT.fullName}`,
  description: `Personalize your ${EVENT.fullName} boarding pass and take it with you.`,
};

/**
 * The studio's own shell.
 *
 * `.pass-studio` scopes the whole ticket palette and the `.mh-*` console
 * chrome (see app/globals.css) — the standalone app put all of it on :root
 * and styled `body` directly, which here would repaint every other route.
 *
 * Space Grotesk is loaded at this level rather than in the root layout so
 * only this route pays for it.
 */
export default function PassLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${spaceGrotesk.variable} pass-studio`}>
      {/*
        The default backdrop is the one thing on the route that is certain to
        be needed and slow — a few hundred KB of photographic JPEG behind the
        pass. Without this the first paint of the studio is a blank stage.
      */}
      {/* .src has already been through asset() in lib/pass/backdrops.ts. */}
      <link
        rel="preload"
        as="image"
        href={backdropDef(DEFAULT_BACKDROP).src}
        fetchPriority="high"
      />
      {children}
    </div>
  );
}
