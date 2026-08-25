export type FontId = "display" | "serif" | "grotesk";

export type FormatId = "portrait" | "square" | "landscape";

export type BackdropId = "sky" | "halftone" | "grove" | "blossom" | "fern";

/**
 * Built-in bouquets, 'none', or the id of an entry in `bouquetUploads` —
 * one handed off from the bouquet mini-game. Widened to `string` so a
 * hacker can hand off any number of designs, each keeping its own id.
 */
export type BouquetId = "none" | "posy" | "sprigs" | "wreath" | (string & {});

/** One bouquet PNG handed off from the mini-game, with the id that selects it. */
export type UploadedBouquet = {
  id: string;
  /**
   * What its designer called it, capped at BOUQUET_NAME_MAX. Empty when they
   * skipped the field, which the picker shows as "Design n" — the label every
   * hand-off had before naming existed.
   */
  name: string;
  /** Data URL — see lib/pass/handoff.ts. */
  dataUrl: string;
};

export type YearId = "freshman" | "sophomore" | "junior" | "senior" | "grad";

export type StudyId =
  | "cs"
  | "design"
  | "electrical"
  | "computer-eng"
  | "business"
  | "ai"
  | "mech-robotics"
  | "undeclared"
  | "other";

export type ExperienceId =
  "sprouting" | "second-flight" | "seasoned" | "frequent";

export type TicketState = {
  name: string;
  /** Free text, not an airport code — not everyone flies in. */
  city: string;
  format: FormatId;
  backdrop: BackdropId;
  font: FontId;
  bouquet: BouquetId;
  /**
   * Every bouquet handed off from /dashboard/bouquet so far, oldest first.
   * `bouquet` selects one by id; the rest stay here so a hacker can switch
   * back to an earlier design without redoing it. Never an arbitrary
   * file — see lib/pass/handoff.ts.
   */
  bouquetUploads: UploadedBouquet[];
  year: YearId | null;
  /** Up to STUDY_MAX — double majors are common. */
  study: StudyId[];
  experience: ExperienceId | null;
  /**
   * Stable per-hacker seed for the barcode and the pass code — the applicant
   * row's id. Null outside the dashboard, where both fall back to hashing the
   * name the way the standalone studio did.
   *
   * Not a control: nothing in controls.tsx writes it. It rides on the state
   * because export-frame → ticket → ticket-{landscape,portrait} already carry
   * `state` end to end, and a context for one string would be worse.
   */
  seed: string | null;
};
