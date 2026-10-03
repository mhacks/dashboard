"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  setReservationWindow,
  setSubmissionWindow,
  setTeamRegistrationWindow,
} from "@/lib/actions/admin-reservations.server.actions";
import type { AdminReservationDetail } from "@/lib/queries/admin-reservations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WindowForm } from "./reservation-event-form";

export function EventOverview({ event }: { event: AdminReservationDetail }) {
  const router = useRouter();

  function saved(message: string) {
    toast.success(message);
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Team registration window</CardTitle>
            <CardDescription>
              Hackers can create a team, invite, accept, decline, cancel,
              rename, or leave only between these times.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WindowForm
              key={`${event.registration.opensAt ?? ""}|${event.registration.closesAt ?? ""}`}
              opensAt={event.registration.opensAt}
              closesAt={event.registration.closesAt}
              save={setTeamRegistrationWindow}
              onSuccess={saved}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Table reservation window</CardTitle>
            <CardDescription>
              A team can claim or move a table only between these times. The
              team has to exist first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WindowForm
              key={`${event.reservation.opensAt ?? ""}|${event.reservation.closesAt ?? ""}`}
              opensAt={event.reservation.opensAt}
              closesAt={event.reservation.closesAt}
              save={setReservationWindow}
              onSuccess={saved}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devpost submission window</CardTitle>
            <CardDescription>
              A team can save its Devpost link only between these times, and
              only after it has reserved a table.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WindowForm
              key={`${event.submission.opensAt ?? ""}|${event.submission.closesAt ?? ""}`}
              opensAt={event.submission.opensAt}
              closesAt={event.submission.closesAt}
              save={setSubmissionWindow}
              onSuccess={saved}
            />
          </CardContent>
        </Card>
      </div>

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
