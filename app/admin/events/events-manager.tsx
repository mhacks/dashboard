"use client";

import { format } from "date-fns";
import {
  ExternalLinkIcon,
  PlusIcon,
  QrCodeIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createEventAction,
  setEventActiveAction,
} from "@/lib/actions/events.server.actions";
import type { AdminEventSummary } from "@/lib/queries/events";
import { slugifyEventName } from "@/lib/types/events";

const EMPTY_FORM = {
  name: "",
  slug: "",
  location: "",
  description: "",
  startsAt: "",
  endsAt: "",
};

export function EventsManager({ events }: { events: AdminEventSummary[] }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  // Shown under the slug field so the URL a volunteer will be sent is visible
  // before the event exists, not discovered afterwards.
  const previewSlug = form.slug.trim() || slugifyEventName(form.name);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createEventAction(form);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Created ${form.name.trim()}.`);
      setForm(EMPTY_FORM);
      setIsCreating(false);
      router.refresh();
    });
  }

  function toggleActive(slug: string, name: string, isActive: boolean) {
    startTransition(async () => {
      const result = await setEventActiveAction({ slug, isActive });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(isActive ? `Opened ${name}.` : `Closed ${name}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>All events</CardTitle>
            <CardDescription>
              Open events appear in every scanner&apos;s list. Closing one stops
              check-ins without deleting anything.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => setIsCreating((open) => !open)}
            variant={isCreating ? "outline" : "default"}
          >
            <PlusIcon data-icon="inline-start" />
            {isCreating ? "Cancel" : "New event"}
          </Button>
        </CardHeader>

        {isCreating ? (
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="grid gap-4 border-t pt-5 sm:grid-cols-2"
            >
              <Field label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Saturday Dinner"
                  required
                  maxLength={120}
                />
              </Field>

              <Field
                label="URL slug"
                hint={
                  previewSlug
                    ? `/checkin/${previewSlug}`
                    : "Type a name, or set one yourself."
                }
              >
                <Input
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder={slugifyEventName(form.name) || "saturday-dinner"}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </Field>

              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Duderstadt Center, first floor"
                />
              </Field>

              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => set("startsAt", e.target.value)}
                />
              </Field>

              <Field label="Ends">
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => set("endsAt", e.target.value)}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Anything the team should know about this one."
                  />
                </Field>
              </div>

              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={isPending || !form.name.trim()}>
                  {isPending ? "Creating…" : "Create event"}
                </Button>
              </div>
            </form>
          </CardContent>
        ) : null}

        <CardContent>
          {events.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No events yet. Create one and its scanner is immediately available
              to organizers and volunteers.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Checked in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Link
                          href={`/admin/events/${event.slug}`}
                          className="font-medium hover:underline"
                        >
                          {event.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {event.location ?? `/checkin/${event.slug}`}
                        </span>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {event.startsAt
                          ? format(
                              new Date(event.startsAt),
                              "EEE d MMM, h:mm a",
                            )
                          : "—"}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {event.checkinCount}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={event.isActive ? "default" : "secondary"}
                        >
                          {event.isActive ? "Open" : "Closed"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                              toggleActive(
                                event.slug,
                                event.name,
                                !event.isActive,
                              )
                            }
                          >
                            {event.isActive ? "Close" : "Open"}
                          </Button>

                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/events/${event.slug}`}>
                              <UsersIcon data-icon="inline-start" />
                              Roster
                            </Link>
                          </Button>

                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/checkin/${event.slug}`}>
                              <QrCodeIcon data-icon="inline-start" />
                              Scan
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLinkIcon className="size-3.5" />
        Send volunteers straight to an event with its
        <code className="rounded bg-muted px-1 py-0.5">
          /checkin/&lt;slug&gt;
        </code>
        link — they can&apos;t pick the wrong one that way.
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? (
        <p className="font-mono text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
