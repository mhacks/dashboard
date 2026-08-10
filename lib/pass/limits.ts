/*
  Field limits and the one default that doesn't live with its own data.

  Their own module because lib/pass/prefill.ts needs them on the server, and
  their original homes — ticket-parts.tsx (hooks), stickers.tsx and
  bouquets.tsx (inline SVG) — would each drag a component module into a pure
  mapping function. All three still re-export them, so nothing downstream had
  to change.
*/

import type { BouquetId } from "@/lib/pass/types";

/** The passenger slot's type only steps down as far as 19+ characters. */
export const NAME_MAX = 22;

export const CITY_MAX = 20;

/** How many areas of study can be worn at once. Double majors are common. */
export const STUDY_MAX = 2;

/** The pass starts bare; a bouquet is something you choose to add. */
export const DEFAULT_BOUQUET: BouquetId = "none";
