"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  Clock3Icon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createRsvpExceptionAction,
  revokeRsvpExceptionAction,
} from "@/lib/actions/rsvp-exceptions.server.actions";
import type {
  AdminRsvpException,
  RsvpExceptionStatus,
} from "@/lib/types/rsvp-exceptions";
import { RSVP_EXCEPTION_MAX_DURATION_HOURS } from "@/lib/types/rsvp-exceptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadge(status: RsvpExceptionStatus) {
  if (status === "active") return <Badge>Active</Badge>;
  if (status === "expired") return <Badge variant="secondary">Expired</Badge>;
  return <Badge variant="outline">Revoked</Badge>;
}

function searchableText(exception: AdminRsvpException) {
  return [
    exception.applicationName,
    exception.accountEmail,
    exception.note ?? "",
    exception.createdByEmail ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function BackdoorControls({
  initialExceptions,
}: {
  initialExceptions: AdminRsvpException[];
}) {
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [durationHours, setDurationHours] = useState("24");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [isCreating, startCreateTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevoking, startRevokeTransition] = useTransition();

  const filteredExceptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return exceptions;
    return exceptions.filter((exception) =>
      searchableText(exception).includes(query),
    );
  }, [exceptions, search]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startCreateTransition(async () => {
      const result = await createRsvpExceptionAction({
        email,
        durationHours,
        note,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setExceptions((current) => [
        result.exception,
        ...current.filter(
          (exception) =>
            exception.id !== result.exception.id &&
            exception.userId !== result.exception.userId,
        ),
      ]);
      setEmail("");
      setDurationHours("24");
      setNote("");
      setOpen(false);
      toast.success(
        `RSVP exception granted for ${result.exception.applicationName}.`,
      );
    });
  }

  function revokeException(exception: AdminRsvpException) {
    setRevokingId(exception.id);
    startRevokeTransition(async () => {
      const result = await revokeRsvpExceptionAction({ id: exception.id });
      setRevokingId(null);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const now = new Date().toISOString();
      setExceptions((current) =>
        current.map((item) =>
          item.id === exception.id
            ? { ...item, revokedAt: now, updatedAt: now, status: "revoked" }
            : item,
        ),
      );
      toast.success(`RSVP exception revoked for ${exception.applicationName}.`);
    });
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>RSVP Exceptions</CardTitle>
            <CardDescription>
              Grant an accepted applicant a private RSVP window by email.
            </CardDescription>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button type="button">
                <PlusIcon data-icon="inline-start" />
                Grant Exception
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <form className="flex min-h-full flex-col" onSubmit={onSubmit}>
                <SheetHeader>
                  <SheetTitle>Grant RSVP Exception</SheetTitle>
                  <SheetDescription>
                    This extends RSVP access for one accepted applicant.
                  </SheetDescription>
                </SheetHeader>

                <div className="grid gap-4 px-4">
                  <div className="grid gap-2">
                    <Label htmlFor="exception-email">Applicant email</Label>
                    <Input
                      id="exception-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="person@example.com"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="exception-hours">RSVP window</Label>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Input
                        id="exception-hours"
                        type="number"
                        min={1}
                        max={RSVP_EXCEPTION_MAX_DURATION_HOURS}
                        value={durationHours}
                        onChange={(event) =>
                          setDurationHours(event.target.value)
                        }
                        required
                      />
                      <div className="flex h-8 items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground">
                        hours
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="exception-note">Internal note</Label>
                    <Textarea
                      id="exception-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Reason, owner, or context"
                      rows={4}
                    />
                  </div>
                </div>

                <SheetFooter>
                  <Button type="submit" disabled={isCreating}>
                    <Clock3Icon data-icon="inline-start" />
                    {isCreating ? "Granting..." : "Grant RSVP Window"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </CardHeader>

        <CardContent className="grid gap-4 p-0">
          <div className="px-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search exceptions"
                aria-label="Search RSVP exceptions"
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExceptions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-28 text-center text-muted-foreground"
                  >
                    No RSVP exceptions match this view.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExceptions.map((exception) => (
                  <TableRow key={exception.id}>
                    <TableCell className="font-medium">
                      {exception.applicationName}
                    </TableCell>
                    <TableCell>{exception.accountEmail}</TableCell>
                    <TableCell>{statusBadge(exception.status)}</TableCell>
                    <TableCell>{formatDateTime(exception.expiresAt)}</TableCell>
                    <TableCell>{formatDateTime(exception.createdAt)}</TableCell>
                    <TableCell className="max-w-72 truncate">
                      {exception.note || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          exception.status !== "active" ||
                          (isRevoking && revokingId === exception.id)
                        }
                        onClick={() => revokeException(exception)}
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="sm:grid-cols-[auto_1fr]">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ShieldAlertIcon className="size-4" />
          </div>
          <div>
            <CardTitle>Non-applicant backdoor</CardTitle>
            <CardDescription>
              Reserved for event-day adds who never submitted an application.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
