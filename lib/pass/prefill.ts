/*
  Turning an application into a starting pass.

  Every value here is a head start, not a fact: the studio hands all of them to
  the same controls an empty pass would get, and the hacker can overwrite any
  of them. The one thing they cannot change is `seed`, which pins the barcode
  and pass code to them.

  Pure and synchronous — no React, no JSX — so the server component can call it
  directly.
*/

import { comingFromOptions, majorOptions } from "@/app/apply/form-options";
import { DEFAULT_BACKDROP } from "@/lib/pass/backdrops";
import { DEFAULT_FONT } from "@/lib/pass/fonts";
import { DEFAULT_FORMAT } from "@/lib/pass/formats";
import {
  CITY_MAX,
  DEFAULT_BOUQUET,
  NAME_MAX,
  STUDY_MAX,
} from "@/lib/pass/limits";
import type {
  ExperienceId,
  StudyId,
  TicketState,
  YearId,
} from "@/lib/pass/types";

/**
 * The columns of hacker_applicants the pass reads.
 *
 * Hand-written rather than derived from the row type so the page's select()
 * and this function cannot drift apart, and so no essay text is dragged into
 * the client bundle for a pass that never shows it.
 */
export type PassApplicant = {
  id: string;
  firstName: string;
  lastName: string;
  comingFrom: string;
  degree: string;
  graduationYear: number;
  major: string;
  previousHackathons: number;
};

/**
 * 22 characters is a hard cap on the passenger slot, so a long name is
 * shortened rather than cut: surname to an initial first, then dropped
 * entirely. Slicing mid-word only happens to a single first name longer than
 * the whole slot.
 */
export function passengerName(firstName: string, lastName: string): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();

  const full = [first, last].filter(Boolean).join(" ");
  if (full.length <= NAME_MAX) return full;

  const abbreviated = last ? `${first} ${last[0]}.` : first;
  if (abbreviated.length <= NAME_MAX) return abbreviated;

  return first.slice(0, NAME_MAX).trim();
}

const STATE_LABEL = new Map(comingFromOptions.map((o) => [o.value, o.label]));

/**
 * `comingFrom` is a state code from the apply form's dropdown ("MI", "CA",
 * "DC") or the literal "international" — not a city. The pass's FROM slot is
 * free text, so the state name stands in and the hacker can overwrite it with
 * an actual city.
 *
 * "international" has no place name to offer, so it stays blank and the pass
 * falls through to its own ORIGIN_FALLBACK placeholder. Anything unrecognised
 * — a value stored before the options list changed — is passed through rather
 * than dropped.
 */
export function departureCity(comingFrom: string): string {
  const raw = (comingFrom ?? "").trim();
  if (!raw || raw === "international") return "";
  return (STATE_LABEL.get(raw) ?? raw).slice(0, CITY_MAX);
}

/**
 * Spring of the academic year MHacks 2026 falls in. The event is 3–4 October
 * 2026 — the fall term of 2026–27 — so a senior there graduates in 2027.
 */
const PASS_GRAD_BASELINE = 2027;

/**
 * A masters or PhD student is `grad` whatever their graduation year says.
 * Below that, the year is how far their graduation is from the event's.
 *
 * High school has no sticker of its own, so it is left unset rather than
 * guessed at. Graduating in or before 2027 maps to `senior` rather than being
 * left blank — most applicants who put an early year were still enrolled when
 * they applied, and the field is editable either way.
 */
export function passYear(
  degree: string,
  graduationYear: number,
): YearId | null {
  const d = (degree ?? "").trim().toLowerCase();

  if (/master|phd|doctor|grad/.test(d)) return "grad";
  if (/high-school|high school|secondary/.test(d)) return null;
  if (!Number.isFinite(graduationYear)) return null;

  const away = graduationYear - PASS_GRAD_BASELINE;
  if (away <= 0) return "senior";
  if (away === 1) return "junior";
  if (away === 2) return "sophomore";
  return "freshman";
}

/**
 * `major` holds one of majorOptions' slugs, or free text when the applicant
 * chose "Other or multiple majors" and typed their own.
 *
 * Nine study stickers against forty-six majors, so this is deliberately
 * lossy — the buckets are the stickers, not the majors. Anything without a
 * sticker lands on `other`, which is what that sticker is for.
 */
const MAJOR_TO_STUDY: Record<string, StudyId> = {
  cs: "cs",
  se: "cs",
  datasci: "cs",
  infosci: "cs",
  cybersecurity: "cs",
  "game-design": "cs",
  ce: "computer-eng",
  ai: "ai",
  ee: "electrical",
  mech: "mech-robotics",
  robotics: "mech-robotics",
  ae: "mech-robotics",
  hci: "design",
  design: "design",
  "fine-arts": "design",
  arch: "design",
  business: "business",
  accounting: "business",
  econ: "business",
  entrepreneurship: "business",
  finance: "business",
  marketing: "business",
  mis: "business",
};

/*
  Free-text fallback, tested in order. "computer eng" has to be reached before
  anything that could match "computer sci", and \beecs?\b covers both the CS
  and the EE reading at Michigan, where it is one department.

  Free text is also where double majors show up ("CS and Design"), so every
  rule is tested and the first STUDY_MAX matches are kept.
*/
const FREE_TEXT_RULES: ReadonlyArray<readonly [RegExp, StudyId]> = [
  [/computer\s*eng|\bcmpe\b|\bce\b/i, "computer-eng"],
  [/artificial\s*intel|machine\s*learning|\bai\b|\bml\b/i, "ai"],
  [/electrical|\beecs?\b/i, "electrical"],
  [/mechanical|robotic|aerospace|\bmeche?\b/i, "mech-robotics"],
  [/computer\s*sci|software|informatics|data\s*sci|\bcs\b/i, "cs"],
  [/design|\bux\b|\bhci\b|graphic|architect/i, "design"],
  [/business|finance|econ|market|account|entrepreneur/i, "business"],
  [/undeclared|undecided|exploratory/i, "undeclared"],
];

const KNOWN_MAJOR_SLUGS = new Set(majorOptions.map((o) => o.value));

export function passStudy(major: string): StudyId[] {
  const raw = (major ?? "").trim();
  if (!raw) return [];

  const mapped = MAJOR_TO_STUDY[raw];
  if (mapped) return [mapped];
  // A known slug with no sticker of its own — biology, polisci, "other".
  if (KNOWN_MAJOR_SLUGS.has(raw)) return ["other"];

  const hits: StudyId[] = [];
  for (const [pattern, id] of FREE_TEXT_RULES) {
    if (pattern.test(raw) && !hits.includes(id)) hits.push(id);
  }
  return hits.length ? hits.slice(0, STUDY_MAX) : ["other"];
}

/**
 * Buckets are the stickers' own printed ranges (see `count` in
 * components/pass/stickers.tsx): 0–1 sprouting, 2 second flight, 3–4
 * seasoned, 5+ frequent flyer. Anything else would put a hacker on a sticker
 * whose caption contradicts them.
 */
export function passExperience(previousHackathons: number): ExperienceId {
  const n = Number.isFinite(previousHackathons) ? previousHackathons : 0;
  if (n <= 1) return "sprouting";
  if (n === 2) return "second-flight";
  if (n <= 4) return "seasoned";
  return "frequent";
}

/**
 * A pass filled in from the application, ready to be edited.
 *
 * There is always an applicant row: the studio is gated on an accepted
 * decision, which nobody has without one.
 */
export function prefillTicket(applicant: PassApplicant): TicketState {
  return {
    format: DEFAULT_FORMAT,
    backdrop: DEFAULT_BACKDROP,
    font: DEFAULT_FONT,
    bouquet: DEFAULT_BOUQUET,
    bouquetUploads: [],
    name: passengerName(applicant.firstName, applicant.lastName),
    city: departureCity(applicant.comingFrom),
    year: passYear(applicant.degree, applicant.graduationYear),
    study: passStudy(applicant.major),
    experience: passExperience(applicant.previousHackathons),
    seed: applicant.id,
  };
}
