export type FontId = "display" | "serif" | "grotesk";

export type FormatId = "portrait" | "square" | "landscape";

export type BackdropId = "sky" | "halftone" | "grove" | "blossom" | "fern";

/** Built-in bouquets, plus 'none' and 'upload' for a hacker's own PNG. */
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
  /** Data URL of an uploaded bouquet PNG, when bouquet === 'upload'. */
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
