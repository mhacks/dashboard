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
import { Checkbox } from "@/components/ui/checkbox";
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
  setEventMaxCheckinsAction,
  setEventRequiresRsvpAction,
} from "@/lib/actions/events.server.actions";
import type { AdminEventSummary } from "@/lib/queries/events";
import { MAX_EVENT_CHECKINS, slugifyEventName } from "@/lib/types/events";

const EMPTY_FORM = {
  name: "",
  slug: "",
  location: "",
  description: "",
  startsAt: "",
  endsAt: "",
  requiresRsvp: true,
  // A string while it's being typed, so clearing the field doesn't snap it
  // back to a number mid-edit. The action parses and bounds it.
  maxCheckins: "1",
};

export function EventsManager({ events }: { events: AdminEventSummary[] }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  // Shown under the slug field so the URL a volunteer will be sent is visible
  // before the event exists, not discovered afterwards.
  const previewSlug = form.slug.trim() || slugifyEventName(form.name);

  function set<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
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

  function saveMaxCheckins(
    slug: string,
    name: string,
    maxCheckins: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await setEventMaxCheckinsAction({ slug, maxCheckins });
        if (!result.ok) {
          toast.error(result.message);
          resolve(false);
          return;
        }
        toast.success(
          maxCheckins === 1
            ? `${name} now allows one scan per person.`
            : `${name} now allows ${maxCheckins} scans per person.`,
        );
        router.refresh();
        resolve(true);
      });
    });
  }

  function toggleRequiresRsvp(
    slug: string,
    name: string,
    requiresRsvp: boolean,
  ) {
    startTransition(async () => {
      const result = await setEventRequiresRsvpAction({ slug, requiresRsvp });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        requiresRsvp
          ? `${name} now requires a confirmed RSVP.`
          : `${name} is now open to every account.`,
      );
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

              <Field
                label="Scans per person"
                hint="1 for most events. Raise it for seconds at a meal."
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_EVENT_CHECKINS}
                  step={1}
                  value={form.maxCheckins}
                  onChange={(e) => set("maxCheckins", e.target.value)}
                  required
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

              <div className="flex items-start gap-2.5 sm:col-span-2">
                <Checkbox
                  id="requires-rsvp"
                  checked={form.requiresRsvp}
                  onCheckedChange={(checked) =>
                    set("requiresRsvp", checked === true)
                  }
                />
                <div className="grid gap-0.5">
                  <Label htmlFor="requires-rsvp">
                    Require a confirmed RSVP
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Turn this off for qualifying events where any account holder
                    should be checked in.
                  </p>
                </div>
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
                    <TableHead>Scans each</TableHead>
                    <TableHead>Who can attend</TableHead>
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
                        {event.maxCheckins > 1 ? (
                          <span className="block text-xs text-muted-foreground">
                            {event.scanCount} scans
                          </span>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <MaxCheckinsInput
                          // Remount when the saved value changes, so the field
                          // shows what the server now holds.
                          key={event.maxCheckins}
                          value={event.maxCheckins}
                          disabled={isPending}
                          label={`Scans per person for ${event.name}`}
                          onSave={(value) =>
                            saveMaxCheckins(event.slug, event.name, value)
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">
                          {event.requiresRsvp
                            ? "Confirmed RSVPs"
                            : "Any account"}
                        </Badge>
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
                              toggleRequiresRsvp(
                                event.slug,
                                event.name,
                                !event.requiresRsvp,
                              )
                            }
                          >
                            {event.requiresRsvp
                              ? "Allow accounts"
                              : "Require RSVP"}
                          </Button>

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

/**
 * Edits an event's scan limit in place. Saves on blur or Enter rather than on
 * every keystroke, so typing "12" never briefly saves "1".
 */
function MaxCheckinsInput({
  value,
  disabled,
  label,
  onSave,
}: {
  value: number;
  disabled: boolean;
  label: string;
  onSave: (value: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(String(value));

  async function commit() {
    const next = Number(draft);
    if (draft.trim() === "" || next === value) {
      setDraft(String(value));
      return;
    }
    // The action validates too; this only saves a pointless round trip.
    if (!Number.isInteger(next) || next < 1 || next > MAX_EVENT_CHECKINS) {
      toast.error(`Enter a whole number from 1 to ${MAX_EVENT_CHECKINS}.`);
      setDraft(String(value));
      return;
    }
    if (!(await onSave(next))) setDraft(String(value));
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      max={MAX_EVENT_CHECKINS}
      step={1}
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          const input = e.currentTarget;
          setDraft(String(value));
          // Blur after the reset renders, so the save on blur sees the saved
          // value rather than the abandoned draft.
          setTimeout(() => input.blur());
        }
      }}
      className="h-8 w-16 tabular-nums"
    />
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
