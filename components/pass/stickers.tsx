import type { ReactNode } from "react";
import type {
  ExperienceId,
  StudyId,
  TicketState,
  YearId,
} from "@/lib/pass/types";

export type StickerCategory = "year" | "study" | "experience";

export type StickerDef<Id extends string> = {
  id: Id;
  /** Full label, used in the picker. */
  label: string;
  /** Shorter label for the ticket's sticker strip, where space is tight. */
  short?: string;
  /**
   * Hackathon count shown in parentheses beside the label. Experience only —
   * the ranges are contiguous and don't overlap, and each one matches what its
   * sticker is called: Second Flight really is your second.
   */
  count?: string;
  /** Year stickers are text only — the ring icons read as noise at 14px. */
  icon?: ReactNode;
};

/*
  Icons are inline SVG, no emoji. Two families, one per category that has them:

    study       object metaphors — brackets, a nib, a bolt, a chip, a cog
    experience  botanical growth stages, matching the botanical fare classes

  Year carries no icon. It used to draw nested growth rings, but at 14px the
  four- and five-ring marks were indistinguishable from each other and read as
  noise beside the word they were labelling.
*/
function Ico({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      style={{ flex: "none" }}
    >
      {children}
    </svg>
  );
}

export const YEARS: StickerDef<YearId>[] = [
  { id: "freshman", label: "Freshman" },
  { id: "sophomore", label: "Sophomore" },
  { id: "junior", label: "Junior" },
  { id: "senior", label: "Senior" },
  { id: "grad", label: "Grad Student", short: "Grad" },
];

export const STUDIES: StickerDef<StudyId>[] = [
  {
    id: "cs",
    label: "Computer Science",
    short: "CS",
    // angle brackets
    icon: (
      <Ico>
        <path d="M6 3.5L2.2 8L6 12.5" />
        <path d="M10 3.5L13.8 8L10 12.5" />
      </Ico>
    ),
  },
  {
    id: "design",
    label: "Design / UX",
    // pen nib
    icon: (
      <Ico>
        <path d="M8 1.6L12.9 10.4L8 14.4L3.1 10.4Z" />
        <path d="M8 7.6V14.4" />
      </Ico>
    ),
  },
  {
    id: "electrical",
    label: "Electrical",
    // a bolt
    icon: (
      <Ico>
        <path d="M9.2 1.5L4 8.8H7.6L6.8 14.5L12 7.2H8.4Z" />
      </Ico>
    ),
  },
  {
    id: "computer-eng",
    label: "Computer Engineering",
    short: "Computer Eng",
    // a chip with legs
    icon: (
      <Ico>
        <rect x="4.5" y="4.5" width="7" height="7" rx="0.8" />
        <path d="M6.5 1.8V4.5M9.5 1.8V4.5M6.5 11.5V14.2M9.5 11.5V14.2" />
        <path d="M1.8 6.5H4.5M1.8 9.5H4.5M11.5 6.5H14.2M11.5 9.5H14.2" />
      </Ico>
    ),
  },
  {
    id: "business",
    label: "Business",
    // bar chart
    icon: (
      <Ico>
        <path d="M2 13.6H14" />
        <path d="M4 11V7.6" />
        <path d="M8 11V3.4" />
        <path d="M12 11V6" />
      </Ico>
    ),
  },
  {
    id: "ai",
    label: "Artificial Intelligence",
    short: "AI",
    // a small node graph
    icon: (
      <Ico>
        <circle cx="3.4" cy="4.4" r="1.5" />
        <circle cx="3.4" cy="11.6" r="1.5" />
        <circle cx="12.6" cy="8" r="1.5" />
        <circle cx="7.8" cy="8" r="1.5" />
        <path d="M4.7 5.2L6.6 7M4.7 10.8L6.6 9M9.3 8H11.1" />
      </Ico>
    ),
  },
  {
    id: "mech-robotics",
    label: "Mechanical Engineering and Robotics",
    short: "Mech / Robotics",
    // a cog
    icon: (
      <Ico>
        <circle cx="8" cy="8" r="2.4" />
        <path d="M8 1.6V3.6M8 12.4V14.4M1.6 8H3.6M12.4 8H14.4M3.5 3.5L4.9 4.9M11.1 11.1L12.5 12.5M12.5 3.5L11.1 4.9M4.9 11.1L3.5 12.5" />
      </Ico>
    ),
  },
  {
    id: "undeclared",
    label: "Undeclared",
    // an open dashed circle
    icon: (
      <Ico>
        <circle cx="8" cy="8" r="6" strokeDasharray="2.6 2.6" />
      </Ico>
    ),
  },
  {
    id: "other",
    label: "Other",
    // an ellipsis
    icon: (
      <Ico>
        <circle cx="3.6" cy="8" r="0.9" />
        <circle cx="8" cy="8" r="0.9" />
        <circle cx="12.4" cy="8" r="0.9" />
      </Ico>
    ),
  },
];

export const EXPERIENCES: StickerDef<ExperienceId>[] = [
  {
    id: "sprouting",
    label: "Sprouting Hacker",
    count: "0–1",
    icon: (
      <Ico>
        <path d="M8 14.5V7" />
        <path d="M8 7.4C5.2 7.4 3.6 5.5 3.6 3C6.2 3 8 4.9 8 7.4Z" />
      </Ico>
    ),
  },
  {
    id: "second-flight",
    label: "Second Flight",
    count: "2",
    icon: (
      <Ico>
        <path d="M8 14.5V4" />
        <path d="M8 8.6C5.4 8.6 4 6.9 4 4.6C6.4 4.6 8 6.3 8 8.6Z" />
        <path d="M8 6.4C10.6 6.4 12 4.7 12 2.4C9.6 2.4 8 4.1 8 6.4Z" />
      </Ico>
    ),
  },
  {
    id: "seasoned",
    label: "Seasoned Builder",
    count: "3–4",
    icon: (
      <Ico>
        <circle cx="8" cy="8" r="1.7" />
        <g>
          <path d="M8 6.1C6.7 4.7 6.9 2.6 8 1.6C9.1 2.6 9.3 4.7 8 6.1Z" />
        </g>
        <g transform="rotate(90 8 8)">
          <path d="M8 6.1C6.7 4.7 6.9 2.6 8 1.6C9.1 2.6 9.3 4.7 8 6.1Z" />
        </g>
        <g transform="rotate(180 8 8)">
          <path d="M8 6.1C6.7 4.7 6.9 2.6 8 1.6C9.1 2.6 9.3 4.7 8 6.1Z" />
        </g>
        <g transform="rotate(270 8 8)">
          <path d="M8 6.1C6.7 4.7 6.9 2.6 8 1.6C9.1 2.6 9.3 4.7 8 6.1Z" />
        </g>
      </Ico>
    ),
  },
  {
    id: "frequent",
    label: "Frequent Flyer",
    count: "5+",
    icon: (
      <Ico>
        <path d="M8 1.4L11.4 6H4.6Z" />
        <path d="M8 5.6L12.6 10.8H3.4Z" />
        <path d="M8 10.8V14.6" />
      </Ico>
    ),
  },
];

// Re-exported from its own module so the server-side prefill can read it
// without importing this one, which is all inline SVG.
export { STUDY_MAX } from "@/lib/pass/limits";

export type PlacedSticker = {
  /** Unique per sticker, not per category — study can place two. */
  key: string;
  category: StickerCategory;
  label: string;
  icon?: ReactNode;
};

/** The selected stickers, in category order: year, study, experience. */
export function placedStickers(state: TicketState): PlacedSticker[] {
  const placed: PlacedSticker[] = [];

  const year = YEARS.find((s) => s.id === state.year);
  if (year) {
    placed.push({
      key: "year",
      category: "year",
      label: year.short ?? year.label,
      icon: year.icon,
    });
  }

  // In the order they were chosen, so the pass matches the picker.
  for (const id of state.study) {
    const study = STUDIES.find((s) => s.id === id);
    if (study) {
      placed.push({
        key: `study-${study.id}`,
        category: "study",
        label: study.short ?? study.label,
        icon: study.icon,
      });
    }
  }

  const experience = EXPERIENCES.find((s) => s.id === state.experience);
  if (experience) {
    placed.push({
      key: "experience",
      category: "experience",
      label: experience.short ?? experience.label,
      icon: experience.icon,
    });
  }

  return placed;
}
