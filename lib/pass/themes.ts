import type { CSSProperties } from "react";
import type { BackdropId } from "@/lib/pass/types";
import { asset } from "@/lib/landing/asset";

/*
  The pass takes its hue from whatever it is sitting on.

  A pass printed in blueprint blue floats on the sky photograph but fights the
  black-and-white halftone and the green grove. So each backdrop carries a
  ticket theme, and the theme is pushed onto the ticket as CSS custom property
  overrides — every ticket component already reads --mh-*, so nothing in the
  ticket needs to know a theme exists.

  Stickers take their colour from here too, rather than one hue per category.
  Three unrelated pastels on a green pass looked like three stickers from three
  different passes.
*/

export type TicketTheme = {
  /** The MHacks M, pre-rendered in this theme's ink. */
  mark: string;
  /** Shadow the pass casts on its backdrop. */
  shadow: string;
  vars: Record<string, string>;
};

function theme(
  mark: string,
  shadow: string,
  v: {
    ink: string;
    inkDeep: string;
    inkMid: string;
    label: string;
    labelPale: string;
    paper: string;
    paperWarm: string;
    border: string;
    borderStrong: string;
    stickerTint: string;
    stickerInk: string;
    /** The two flecks in the paper's glitter, after white. */
    sheenA: string;
    sheenB: string;
  },
): TicketTheme {
  return {
    mark,
    shadow,
    vars: {
      "--mh-moss": v.ink,
      "--mh-moss-deep": v.inkDeep,
      "--mh-moss-mid": v.inkMid,
      "--mh-sage": v.label,
      "--mh-sage-pale": v.labelPale,
      "--mh-paper": v.paper,
      "--mh-paper-warm": v.paperWarm,
      "--mh-border": v.border,
      "--mh-border-strong": v.borderStrong,
      "--mh-sticker-tint": v.stickerTint,
      "--mh-sticker-ink": v.stickerInk,
      "--mh-sheen-a": v.sheenA,
      "--mh-sheen-b": v.sheenB,
    },
  };
}

export const TICKET_THEMES: Record<BackdropId, TicketTheme> = {
  /*
    Sky teal. This was an electric blueprint blue, which read as navy against
    the photograph — the sky in that image is a desaturated teal, so the pass
    now takes its hue from the backdrop rather than sitting on top of it.
  */
  sky: theme(asset("/pass/marks/mhacks-m-sky.png"), "rgba(10, 40, 52, 0.42)", {
    ink: "#2f7f9e",
    inkDeep: "#143a4a",
    inkMid: "#245c73",
    label: "#4a7d92",
    labelPale: "#b3cdd8",
    paper: "#f0f7fa",
    paperWarm: "#e3eef4",
    border: "rgba(20, 58, 74, 0.16)",
    borderStrong: "rgba(20, 58, 74, 0.32)",
    stickerTint: "#dceaf1",
    stickerInk: "#245c73",
    sheenA: "#bcd8e6",
    sheenB: "#e4f0f6",
  }),

  /* Pale white stock in near-black, so the screened foliage stays the subject. */
  halftone: theme(
    asset("/pass/marks/mhacks-m-ink.png"),
    "rgba(14, 14, 16, 0.44)",
    {
      ink: "#2b2b2e",
      inkDeep: "#111113",
      inkMid: "#35353a",
      label: "#6a6a70",
      labelPale: "#c6c6ca",
      paper: "#fbfbfa",
      paperWarm: "#f2f2f0",
      border: "rgba(17, 17, 19, 0.16)",
      borderStrong: "rgba(17, 17, 19, 0.32)",
      stickerTint: "#eeeeec",
      stickerInk: "#3a3a3e",
      sheenA: "#d8d8d8",
      sheenB: "#efefee",
    },
  ),

  /* Green, for the solarized grove. */
  grove: theme(
    asset("/pass/marks/mhacks-m-grove.png"),
    "rgba(12, 38, 22, 0.44)",
    {
      ink: "#2f6b45",
      inkDeep: "#13341f",
      inkMid: "#245537",
      label: "#4d7a5c",
      labelPale: "#b3ccb9",
      paper: "#f2f7f1",
      paperWarm: "#e6efe4",
      border: "rgba(19, 52, 31, 0.16)",
      borderStrong: "rgba(19, 52, 31, 0.32)",
      stickerTint: "#dcebda",
      stickerInk: "#245537",
      sheenA: "#bcd8bf",
      sheenB: "#e4efe2",
    },
  ),

  /* Dusty rose, for the ASCII bloom. */
  blossom: theme(
    asset("/pass/marks/mhacks-m-blossom.png"),
    "rgba(70, 20, 38, 0.42)",
    {
      ink: "#c04a72",
      inkDeep: "#5c1e33",
      inkMid: "#8e3252",
      label: "#97516b",
      labelPale: "#e3bccb",
      paper: "#fdf4f7",
      paperWarm: "#f8e8ee",
      border: "rgba(92, 30, 51, 0.16)",
      borderStrong: "rgba(92, 30, 51, 0.32)",
      stickerTint: "#fae0e8",
      stickerInk: "#8e3252",
      sheenA: "#f3c8d8",
      sheenB: "#fbe8ef",
    },
  ),

  /* Purple, for the stippled leaves. */
  fern: theme(
    asset("/pass/marks/mhacks-m-fern.png"),
    "rgba(40, 14, 48, 0.44)",
    {
      ink: "#7b2d8e",
      inkDeep: "#34123c",
      inkMid: "#5a2168",
      label: "#6f4a79",
      labelPale: "#cfb9d6",
      paper: "#f9f4fb",
      paperWarm: "#f0e6f4",
      border: "rgba(52, 18, 60, 0.16)",
      borderStrong: "rgba(52, 18, 60, 0.32)",
      stickerTint: "#ede0f2",
      stickerInk: "#5a2168",
      sheenA: "#dcc4e6",
      sheenB: "#f1e6f5",
    },
  ),
};

export function ticketTheme(id: BackdropId): TicketTheme {
  return TICKET_THEMES[id] ?? TICKET_THEMES.sky;
}

/** The theme's overrides, ready to spread onto a wrapper's `style`. */
export function themeStyle(id: BackdropId): CSSProperties {
  return ticketTheme(id).vars as CSSProperties;
}
