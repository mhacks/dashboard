import type { FormatId } from "@/lib/pass/types";
import {
  TICKET_H,
  TICKET_P_H,
  TICKET_P_W,
  TICKET_W,
} from "@/lib/pass/geometry";

export type FormatDef = {
  id: FormatId;
  label: string;
  /** Shown under the label so the ratio is never a guess. */
  ratio: string;
  /** Where this one is meant to go. */
  note: string;
  /** Exact pixel dimensions of the exported PNG. */
  width: number;
  height: number;
  /** Which way the ticket itself sits inside the frame. */
  orientation: "portrait" | "landscape";
  /** Breathing room between the ticket and the frame edge, in frame px. */
  padding: number;
};

/*
  The frame is laid out in the DOM at these exact pixel dimensions and only
  transform-scaled down for the preview, so what you see and what the exporter
  rasterizes are the same node — the export can never drift from the preview.
*/
export const FORMATS: FormatDef[] = [
  {
    id: "portrait",
    label: "Portrait",
    ratio: "9:16",
    note: "instagram story",
    width: 1080,
    height: 1920,
    orientation: "portrait",
    padding: 100,
  },
  {
    id: "square",
    label: "Square",
    ratio: "1:1",
    note: "instagram post",
    width: 1080,
    height: 1080,
    orientation: "landscape",
    padding: 56,
  },
  {
    id: "landscape",
    label: "Landscape",
    ratio: "1.91:1",
    note: "linkedin · feed post",
    width: 1200,
    height: 628,
    orientation: "landscape",
    padding: 60,
  },
];

export const DEFAULT_FORMAT: FormatId = "portrait";

export function formatDef(id: FormatId): FormatDef {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

/** The ticket's own dimensions for a format's orientation. */
export function ticketSize(format: FormatDef): { w: number; h: number } {
  return format.orientation === "portrait"
    ? { w: TICKET_P_W, h: TICKET_P_H }
    : { w: TICKET_W, h: TICKET_H };
}

/** How far the ticket scales to fill the frame inside its padding. */
export function ticketScale(format: FormatDef): number {
  const { w, h } = ticketSize(format);
  return Math.min(
    (format.width - format.padding * 2) / w,
    (format.height - format.padding * 2) / h,
  );
}
