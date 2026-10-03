import type { ReactNode } from "react";

import { requireJudgePage } from "@/lib/auth/guards";

/**
 * The judge gate. The actions check `requireJudge()` themselves; this is the
 * navigation gate, not the security boundary.
 */
export default async function JudgeLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireJudgePage();
  return <div className="font-red-hat">{children}</div>;
}
