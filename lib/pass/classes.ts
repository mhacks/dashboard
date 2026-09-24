import type { ExperienceId } from "@/lib/pass/types";

/*
  The parent site is a garden, not an airport, so the fare classes are botanical.
  Driven by the experience sticker; before one is chosen the pass is UNPLANTED.
*/
export const FARE_CLASS: Record<ExperienceId, string> = {
  sprouting: "SEEDLING",
  "second-flight": "SAPLING",
  seasoned: "IN BLOOM",
  frequent: "EVERGREEN",
};

export const FARE_CLASS_UNSET = "UNPLANTED";

export function fareClass(experience: ExperienceId | null): string {
  return experience ? FARE_CLASS[experience] : FARE_CLASS_UNSET;
}
