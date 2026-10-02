"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminReservationDetail } from "@/lib/queries/admin-reservations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReservationEventForm } from "./reservation-event-form";

export function EventOverview({ event }: { event: AdminReservationDetail }) {
  const router = useRouter();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Reservation window</CardTitle>
          <CardDescription>
            Hackers can claim or move a table only between these times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReservationEventForm
            key={event.updatedAt}
            event={event}
            onSuccess={(message) => {
              toast.success(message);
              router.refresh();
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tables</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Tables</span>
            <span>{event.tableCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Assigned teams</span>
            <span>{event.assignedCount}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
