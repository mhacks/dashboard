import type { ReactNode } from "react";

import { requireJudgingStaffPage } from "@/lib/auth/guards";

export default async function JudgeLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireJudgingStaffPage();
  return <div className="font-red-hat">{children}</div>;
}
