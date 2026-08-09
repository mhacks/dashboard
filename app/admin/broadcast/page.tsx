import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader } from "../components/admin-page-header";
import { AdminPageShell } from "../components/admin-page-shell";
import BroadcastForm from "./BroadcastForm";

export default async function BroadcastPage() {
  const [{ value: hackerCount }] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.role, "hacker"));

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Broadcast"
        description={`Send an email to all ${hackerCount} hackers. Use sparingly.`}
      />

      <Card>
        <CardContent>
          <BroadcastForm hackerCount={hackerCount} />
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="outline">
          <a href="/admin/broadcast/logs">View logs</a>
        </Button>
      </div>
    </AdminPageShell>
  );
}
