export type FontId = "display" | "serif" | "grotesk";

export type FormatId = "portrait" | "square" | "landscape";

export type BackdropId = "sky" | "halftone" | "grove" | "blossom" | "fern";

/** Built-in bouquets, plus 'none' and 'upload' for one handed off from the bouquet mini-game. */
export type BouquetId = "none" | "posy" | "sprigs" | "wreath" | "upload";

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
   * Data URL of the bouquet PNG handed off from /dashboard/bouquet, when
   * bouquet === 'upload'. Never an arbitrary file — see lib/pass/handoff.ts.
   */
  bouquetUpload: string | null;
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
