import type { ReactNode } from "react";
import { requireOrganizerPage } from "@/lib/auth/guards";

export default async function AdminApplicationsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireOrganizerPage("/admin/applications");

  return children;
}
