// Pure resolution: given the schema and the two value sources (live Supabase
// status + the existing .env), compute the final value for every variable.

import type { EnvSection } from "./schema.ts";
import type { EnvMap } from "./io.ts";

export interface ResolveInputs {
  /** Values from `supabase status -o env`. */
  readonly status: EnvMap;
  /** Values parsed from the current .env (for `preserved` sources). */
  readonly existing: EnvMap;
}

/** A `supabaseStatus(...)` var referenced a key the CLI didn't return. */
export class MissingStatusKeyError extends Error {
  readonly missing: { name: string; statusKey: string }[];
  constructor(missing: { name: string; statusKey: string }[]) {
    super(
      "supabase status did not return: " +
        missing.map((m) => m.statusKey).join(", "),
    );
    this.name = "MissingStatusKeyError";
    this.missing = missing;
  }
}

/** Resolve every variable to its final value, or throw if a source is missing. */
export function resolveValues(
  sections: readonly EnvSection[],
  { status, existing }: ResolveInputs,
): Record<string, string> {
  const values: Record<string, string> = {};
  const missing: { name: string; statusKey: string }[] = [];

  for (const section of sections) {
    for (const v of section.vars) {
      switch (v.source.kind) {
        case "supabase": {
          const value = status[v.source.statusKey];
          if (value === undefined) {
            missing.push({ name: v.name, statusKey: v.source.statusKey });
          } else {
            values[v.name] = value;
          }
          break;
        }
        case "preserved": {
          values[v.name] = existing[v.name] ?? v.source.fallback;
          break;
        }
      }
    }
  }

  if (missing.length) throw new MissingStatusKeyError(missing);
  return values;
}
