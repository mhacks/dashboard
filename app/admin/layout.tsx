import type { ReactNode } from "react";
import { requireOrganizerPage } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireOrganizerPage();
  return children;
}
