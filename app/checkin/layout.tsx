import type { ReactNode } from "react";

import { requireEventStaffPage } from "@/lib/auth/guards";

/**
 * The staff gate for every scanner route.
 *
 * Deliberately not in the middleware: that would add a Supabase round-trip plus
 * a database read to the hot path for a check the layout already does. The
 * middleware still forces a login, because /checkin is not on its public
 * allowlist — this only decides which signed-in people may go further.
 *
 * The actions do their own `requireEventStaff()` regardless. This is the
 * navigation gate, not the security boundary.
 */
export default async function CheckInLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireEventStaffPage();
  return <div className="font-red-hat">{children}</div>;
}
