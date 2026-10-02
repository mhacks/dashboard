import type { ReactNode } from "react";
import Link from "next/link";
import { EyeIcon } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { TeamsNav } from "./teams-nav";

export default function TeamsLayout({ children }: { children: ReactNode }) {
  return (
    <AdminPageShell>
      <AdminPageHeader
        variant="workspace"
        title="Teams and reservations"
        description="Teams hackers have formed, and the one window where they reserve a table."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/teams/reservations/preview">
              <EyeIcon data-icon="inline-start" />
              Preview participant view
            </Link>
          </Button>
        }
        footer={<TeamsNav />}
      />
      {children}
    </AdminPageShell>
  );
}
