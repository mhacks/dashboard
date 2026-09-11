"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  CalendarDaysIcon,
  ExternalLinkIcon,
  LinkIcon,
  MegaphoneIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  TrophyIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveLiveAnnouncement,
  archiveLiveEvent,
  archiveLiveGuideLink,
  archiveLivePrize,
  saveLiveAnnouncement,
  saveLiveEvent,
  saveLiveGuideLink,
  saveLivePrize,
  saveLiveSiteSettings,
  type LiveSiteActionResult,
} from "@/lib/actions/live-site.server.actions";
import {
  LIVE_ANNOUNCEMENT_TONES,
  LIVE_CONTENT_STATUSES,
  LIVE_EVENT_RESOURCE_KINDS,
  type EventResource,
  type GuideLink,
  type LiveAnnouncement,
  type LiveContentStatus,
  type LiveEvent,
  type LiveSiteContent,
  type LiveSiteSettings,
  type Prize,
} from "@/lib/live/types";

type EditorState =
  | { kind: "event"; item: LiveEvent | null }
  | { kind: "announcement"; item: LiveAnnouncement | null }
  | { kind: "guide"; item: GuideLink | null }
  | { kind: "prize"; item: Prize | null }
  | null;

function fieldString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function localInputValue(iso: string | null, timezone: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function wallTimeToIso(value: string, timezone: string) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return value;

  const [, year, month, day, hour, minute] = match;
  const target = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let guess = target;

  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(new Date(guess));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((entry) => entry.type === type)?.value ?? 0);
    const observed = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
    );
    guess += target - observed;
  }

  return new Date(guess).toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function positionValue(formData: FormData) {
  return Math.max(0, Number(fieldString(formData, "position")) || 0);
}

function Field({
  children,
  label,
  name,
}: {
  children: ReactNode;
  label: string;
  name: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  );
}

function StatusSelect({ defaultValue }: { defaultValue: LiveContentStatus }) {
  return (
    <Select name="status" defaultValue={defaultValue}>
      <SelectTrigger id="status" className="h-9 rounded-md">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LIVE_CONTENT_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusBadge({ status }: { status: LiveContentStatus }) {
  return (
    <Badge
      variant={status === "published" ? "default" : "outline"}
      className="rounded-md capitalize"
    >
      {status}
    </Badge>
  );
}

function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed px-5 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ContentActions({
  archived,
  onArchive,
  onEdit,
}: {
  archived: boolean;
  onArchive: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit}>
        <PencilIcon />
        <span className="sr-only">Edit</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onArchive}
        disabled={archived}
      >
        <ArchiveIcon />
        <span className="sr-only">Archive</span>
      </Button>
    </div>
  );
}

function SettingsPanel({
  onResult,
  settings,
}: {
  onResult: (label: string, result: Promise<LiveSiteActionResult>) => void;
  settings: LiveSiteSettings;
}) {
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onResult(
          "Settings saved",
          saveLiveSiteSettings({
            eventName: fieldString(formData, "eventName"),
            heroTitle: fieldString(formData, "heroTitle"),
            heroDescription: fieldString(formData, "heroDescription"),
            timezone: fieldString(formData, "timezone"),
            devpostUrl: fieldString(formData, "devpostUrl"),
            guideEmptyTitle: fieldString(formData, "guideEmptyTitle"),
            guideEmptyDescription: fieldString(
              formData,
              "guideEmptyDescription",
            ),
            prizesEmptyTitle: fieldString(formData, "prizesEmptyTitle"),
            prizesEmptyDescription: fieldString(
              formData,
              "prizesEmptyDescription",
            ),
          }),
        );
      }}
    >
      <SectionHeader
        title="Site settings"
        description="Control the public header, timezone, Devpost link, and empty states."
        action={<Button type="submit">Save settings</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="eventName" label="Site label">
          <Input
            id="eventName"
            name="eventName"
            defaultValue={settings.eventName}
            required
          />
        </Field>
        <Field name="heroTitle" label="Page title">
          <Input
            id="heroTitle"
            name="heroTitle"
            defaultValue={settings.heroTitle}
            required
          />
        </Field>
        <Field name="timezone" label="IANA timezone">
          <Input
            id="timezone"
            name="timezone"
            defaultValue={settings.timezone}
            placeholder="America/Detroit"
            required
          />
        </Field>
        <Field name="devpostUrl" label="Devpost URL">
          <Input
            id="devpostUrl"
            name="devpostUrl"
            type="url"
            defaultValue={settings.devpostUrl ?? ""}
            placeholder="https://..."
          />
        </Field>
      </div>
      <Field name="heroDescription" label="Header description">
        <Textarea
          id="heroDescription"
          name="heroDescription"
          defaultValue={settings.heroDescription}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <Field name="guideEmptyTitle" label="Empty guide title">
            <Input
              id="guideEmptyTitle"
              name="guideEmptyTitle"
              defaultValue={settings.guideEmptyTitle}
              required
            />
          </Field>
          <Field name="guideEmptyDescription" label="Empty guide message">
            <Textarea
              id="guideEmptyDescription"
              name="guideEmptyDescription"
              defaultValue={settings.guideEmptyDescription}
              required
            />
          </Field>
        </div>
        <div className="space-y-4">
          <Field name="prizesEmptyTitle" label="Empty prizes title">
            <Input
              id="prizesEmptyTitle"
              name="prizesEmptyTitle"
              defaultValue={settings.prizesEmptyTitle}
              required
            />
          </Field>
          <Field name="prizesEmptyDescription" label="Empty prizes message">
            <Textarea
              id="prizesEmptyDescription"
              name="prizesEmptyDescription"
              defaultValue={settings.prizesEmptyDescription}
              required
            />
          </Field>
        </div>
      </div>
    </form>
  );
}

function EventEditor({
  item,
  onResult,
  timezone,
}: {
  item: LiveEvent | null;
  onResult: (label: string, result: Promise<LiveSiteActionResult>) => void;
  timezone: string;
}) {
  const [resources, setResources] = useState<EventResource[]>(
    item?.resources ?? [],
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const capacity = fieldString(formData, "capacity");
        onResult(
          item ? "Event updated" : "Event created",
          saveLiveEvent({
            id: item?.id ?? "",
            slug: fieldString(formData, "slug"),
            name: fieldString(formData, "name"),
            summary: fieldString(formData, "summary"),
            description: fieldString(formData, "description"),
            startsAt: wallTimeToIso(
              fieldString(formData, "startsAt"),
              timezone,
            ),
            endsAt: wallTimeToIso(fieldString(formData, "endsAt"), timezone),
            location: fieldString(formData, "location"),
            locationDetails: fieldString(formData, "locationDetails"),
            mapUrl: fieldString(formData, "mapUrl"),
            eventType: fieldString(formData, "eventType"),
            hostName: fieldString(formData, "hostName"),
            audience: fieldString(formData, "audience"),
            capacity: capacity ? Number(capacity) : null,
            featured: formData.get("featured") === "on",
            status: fieldString(formData, "status"),
            position: positionValue(formData),
            resources,
          }),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Event name">
          <Input id="name" name="name" defaultValue={item?.name} required />
        </Field>
        <Field name="slug" label="URL slug">
          <Input id="slug" name="slug" defaultValue={item?.slug} required />
        </Field>
        <Field name="eventType" label="Category">
          <Input
            id="eventType"
            name="eventType"
            defaultValue={item?.eventType}
            placeholder="Workshop"
            required
          />
        </Field>
        <Field name="hostName" label="Host">
          <Input
            id="hostName"
            name="hostName"
            defaultValue={item?.hostName ?? ""}
          />
        </Field>
        <Field name="startsAt" label="Starts">
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={localInputValue(item?.startsAt ?? null, timezone)}
            required
          />
        </Field>
        <Field name="endsAt" label="Ends">
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={localInputValue(item?.endsAt ?? null, timezone)}
          />
        </Field>
        <Field name="location" label="Location">
          <Input
            id="location"
            name="location"
            defaultValue={item?.location}
            required
          />
        </Field>
        <Field name="mapUrl" label="Map URL">
          <Input
            id="mapUrl"
            name="mapUrl"
            type="url"
            defaultValue={item?.mapUrl ?? ""}
          />
        </Field>
        <Field name="audience" label="Audience">
          <Input
            id="audience"
            name="audience"
            defaultValue={item?.audience ?? ""}
          />
        </Field>
        <Field name="capacity" label="Capacity">
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min="1"
            defaultValue={item?.capacity ?? ""}
          />
        </Field>
        <Field name="status" label="Publication status">
          <StatusSelect defaultValue={item?.status ?? "draft"} />
        </Field>
        <Field name="position" label="Sort position">
          <Input
            id="position"
            name="position"
            type="number"
            min="0"
            defaultValue={item?.position ?? 0}
          />
        </Field>
      </div>
      <Field name="summary" label="Short summary">
        <Input id="summary" name="summary" defaultValue={item?.summary} />
      </Field>
      <Field name="description" label="Full details">
        <Textarea
          id="description"
          name="description"
          className="min-h-28"
          defaultValue={item?.description}
        />
      </Field>
      <Field name="locationDetails" label="Room and arrival details">
        <Textarea
          id="locationDetails"
          name="locationDetails"
          defaultValue={item?.locationDetails}
        />
      </Field>
      <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
        <Label htmlFor="featured">Featured event</Label>
        <Checkbox
          id="featured"
          name="featured"
          defaultChecked={item?.featured}
        />
      </div>
      <div className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Resource links</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setResources((current) => [
                ...current,
                {
                  id: "",
                  kind: "resource",
                  label: "",
                  href: null,
                  position: current.length,
                },
              ])
            }
          >
            <PlusIcon />
            Add link
          </Button>
        </div>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No event links.</p>
        ) : (
          resources.map((resource, index) => (
            <div
              key={`${resource.id || "new"}-${index}`}
              className="grid gap-2 border-l-2 pl-3 sm:grid-cols-[8rem_1fr_1.4fr_auto]"
            >
              <Select
                value={resource.kind}
                onValueChange={(kind: EventResource["kind"]) =>
                  setResources((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, kind } : entry,
                    ),
                  )
                }
              >
                <SelectTrigger className="h-9 rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIVE_EVENT_RESOURCE_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={resource.label}
                placeholder="Label"
                aria-label="Resource label"
                onChange={(event) =>
                  setResources((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, label: event.target.value }
                        : entry,
                    ),
                  )
                }
                required
              />
              <Input
                value={resource.href ?? ""}
                type="url"
                placeholder="https://..."
                aria-label="Resource URL"
                onChange={(event) =>
                  setResources((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, href: event.target.value || null }
                        : entry,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  setResources((current) =>
                    current.filter((_, entryIndex) => entryIndex !== index),
                  )
                }
              >
                <XIcon />
                <span className="sr-only">Remove resource</span>
              </Button>
            </div>
          ))
        )}
      </div>
      <SheetFooter>
        <Button type="submit">{item ? "Save event" : "Create event"}</Button>
      </SheetFooter>
    </form>
  );
}

function AnnouncementEditor({
  item,
  onResult,
  timezone,
}: {
  item: LiveAnnouncement | null;
  onResult: (label: string, result: Promise<LiveSiteActionResult>) => void;
  timezone: string;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onResult(
          item ? "Announcement updated" : "Announcement created",
          saveLiveAnnouncement({
            id: item?.id ?? "",
            title: fieldString(formData, "title"),
            body: fieldString(formData, "body"),
            tone: fieldString(formData, "tone"),
            status: fieldString(formData, "status"),
            publishedAt: wallTimeToIso(
              fieldString(formData, "publishedAt"),
              timezone,
            ),
            expiresAt: wallTimeToIso(
              fieldString(formData, "expiresAt"),
              timezone,
            ),
            position: positionValue(formData),
          }),
        );
      }}
    >
      <Field name="title" label="Title">
        <Input id="title" name="title" defaultValue={item?.title} required />
      </Field>
      <Field name="body" label="Message">
        <Textarea
          id="body"
          name="body"
          className="min-h-28"
          defaultValue={item?.body}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="tone" label="Tone">
          <Select name="tone" defaultValue={item?.tone ?? "info"}>
            <SelectTrigger id="tone" className="h-9 rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIVE_ANNOUNCEMENT_TONES.map((tone) => (
                <SelectItem key={tone} value={tone}>
                  {tone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field name="status" label="Publication status">
          <StatusSelect defaultValue={item?.status ?? "draft"} />
        </Field>
        <Field name="publishedAt" label="Publish at">
          <Input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={localInputValue(item?.postedAt ?? null, timezone)}
          />
        </Field>
        <Field name="expiresAt" label="Expire at">
          <Input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={localInputValue(item?.expiresAt ?? null, timezone)}
          />
        </Field>
        <Field name="position" label="Sort position">
          <Input
            id="position"
            name="position"
            type="number"
            min="0"
            defaultValue={item?.position ?? 0}
          />
        </Field>
      </div>
      <SheetFooter>
        <Button type="submit">
          {item ? "Save announcement" : "Create announcement"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function GuideEditor({
  item,
  onResult,
}: {
  item: GuideLink | null;
  onResult: (label: string, result: Promise<LiveSiteActionResult>) => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onResult(
          item ? "Guide link updated" : "Guide link created",
          saveLiveGuideLink({
            id: item?.id ?? "",
            title: fieldString(formData, "title"),
            description: fieldString(formData, "description"),
            href: fieldString(formData, "href"),
            category: fieldString(formData, "category"),
            status: fieldString(formData, "status"),
            position: positionValue(formData),
          }),
        );
      }}
    >
      <Field name="title" label="Title">
        <Input id="title" name="title" defaultValue={item?.title} required />
      </Field>
      <Field name="description" label="Description">
        <Textarea
          id="description"
          name="description"
          defaultValue={item?.description}
        />
      </Field>
      <Field name="href" label="URL">
        <Input
          id="href"
          name="href"
          type="url"
          defaultValue={item?.href}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="category" label="Category">
          <Input
            id="category"
            name="category"
            defaultValue={item?.category ?? "General"}
            required
          />
        </Field>
        <Field name="status" label="Publication status">
          <StatusSelect defaultValue={item?.status ?? "draft"} />
        </Field>
        <Field name="position" label="Sort position">
          <Input
            id="position"
            name="position"
            type="number"
            min="0"
            defaultValue={item?.position ?? 0}
          />
        </Field>
      </div>
      <SheetFooter>
        <Button type="submit">{item ? "Save link" : "Create link"}</Button>
      </SheetFooter>
    </form>
  );
}

function PrizeEditor({
  item,
  onResult,
}: {
  item: Prize | null;
  onResult: (label: string, result: Promise<LiveSiteActionResult>) => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onResult(
          item ? "Prize updated" : "Prize created",
          saveLivePrize({
            id: item?.id ?? "",
            title: fieldString(formData, "title"),
            description: fieldString(formData, "description"),
            sponsor: fieldString(formData, "sponsor"),
            value: fieldString(formData, "value"),
            eligibility: fieldString(formData, "eligibility"),
            judgingCriteria: fieldString(formData, "judgingCriteria"),
            href: fieldString(formData, "href"),
            status: fieldString(formData, "status"),
            position: positionValue(formData),
          }),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="title" label="Prize title">
          <Input id="title" name="title" defaultValue={item?.title} required />
        </Field>
        <Field name="sponsor" label="Sponsor">
          <Input
            id="sponsor"
            name="sponsor"
            defaultValue={item?.sponsor ?? ""}
          />
        </Field>
        <Field name="value" label="Prize value">
          <Input id="value" name="value" defaultValue={item?.value ?? ""} />
        </Field>
        <Field name="href" label="Details URL">
          <Input
            id="href"
            name="href"
            type="url"
            defaultValue={item?.href ?? ""}
          />
        </Field>
      </div>
      <Field name="description" label="Description">
        <Textarea
          id="description"
          name="description"
          defaultValue={item?.description}
        />
      </Field>
      <Field name="eligibility" label="Eligibility">
        <Textarea
          id="eligibility"
          name="eligibility"
          defaultValue={item?.eligibility}
        />
      </Field>
      <Field name="judgingCriteria" label="Judging criteria">
        <Textarea
          id="judgingCriteria"
          name="judgingCriteria"
          defaultValue={item?.judgingCriteria}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="status" label="Publication status">
          <StatusSelect defaultValue={item?.status ?? "draft"} />
        </Field>
        <Field name="position" label="Sort position">
          <Input
            id="position"
            name="position"
            type="number"
            min="0"
            defaultValue={item?.position ?? 0}
          />
        </Field>
      </div>
      <SheetFooter>
        <Button type="submit">{item ? "Save prize" : "Create prize"}</Button>
      </SheetFooter>
    </form>
  );
}

export function LiveSiteManager({
  initialContent,
}: {
  initialContent: LiveSiteContent;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState>(null);
  const [isPending, startTransition] = useTransition();

  const handleResult = (
    successMessage: string,
    resultPromise: Promise<LiveSiteActionResult>,
  ) => {
    startTransition(async () => {
      const result = await resultPromise;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      setEditor(null);
      router.refresh();
    });
  };

  const archive = (
    label: string,
    action: (id: string) => Promise<LiveSiteActionResult>,
    id: string,
  ) => handleResult(`${label} archived`, action(id));

  return (
    <>
      <Tabs defaultValue="settings" className="gap-6">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-3 overflow-x-auto border-b pb-2"
        >
          <TabsTrigger value="settings" className="h-9 px-3">
            <Settings2Icon /> Settings
          </TabsTrigger>
          <TabsTrigger value="events" className="h-9 px-3">
            <CalendarDaysIcon /> Events
          </TabsTrigger>
          <TabsTrigger value="announcements" className="h-9 px-3">
            <MegaphoneIcon /> Announcements
          </TabsTrigger>
          <TabsTrigger value="guide" className="h-9 px-3">
            <LinkIcon /> Guide
          </TabsTrigger>
          <TabsTrigger value="prizes" className="h-9 px-3">
            <TrophyIcon /> Prizes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <SettingsPanel
            settings={initialContent.settings}
            onResult={handleResult}
          />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <SectionHeader
            title="Events"
            description="Publish the same events used by check-in, then add the detail attendees need."
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/admin/events">Check-in settings</Link>
                </Button>
                <Button
                  onClick={() => setEditor({ kind: "event", item: null })}
                >
                  <PlusIcon /> Add event
                </Button>
              </div>
            }
          />
          {initialContent.events.length === 0 ? (
            <EmptyState>No events have been added.</EmptyState>
          ) : (
            <div className="divide-y border-y">
              {initialContent.events.map((event) => (
                <article
                  key={event.id}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{event.name}</h3>
                      <StatusBadge status={event.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDateTime(event.startsAt)} · {event.location} ·{" "}
                      {event.eventType}
                    </p>
                    {event.summary ? (
                      <p className="mt-2 line-clamp-2 text-sm">
                        {event.summary}
                      </p>
                    ) : null}
                  </div>
                  <ContentActions
                    archived={event.status === "archived"}
                    onEdit={() => setEditor({ kind: "event", item: event })}
                    onArchive={() =>
                      archive("Event", archiveLiveEvent, event.id)
                    }
                  />
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <SectionHeader
            title="Announcements"
            description="Publish attendee updates immediately or schedule a window."
            action={
              <Button
                onClick={() => setEditor({ kind: "announcement", item: null })}
              >
                <PlusIcon /> Add announcement
              </Button>
            }
          />
          {initialContent.announcements.length === 0 ? (
            <EmptyState>No announcements have been added.</EmptyState>
          ) : (
            <div className="divide-y border-y">
              {initialContent.announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <StatusBadge status={announcement.status} />
                      <Badge
                        variant="outline"
                        className="rounded-md capitalize"
                      >
                        {announcement.tone}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {announcement.body}
                    </p>
                  </div>
                  <ContentActions
                    archived={announcement.status === "archived"}
                    onEdit={() =>
                      setEditor({ kind: "announcement", item: announcement })
                    }
                    onArchive={() =>
                      archive(
                        "Announcement",
                        archiveLiveAnnouncement,
                        announcement.id,
                      )
                    }
                  />
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="guide" className="space-y-4">
          <SectionHeader
            title="Hacker guide links"
            description="Centralize venue, policy, travel, workshop, and support resources."
            action={
              <Button onClick={() => setEditor({ kind: "guide", item: null })}>
                <PlusIcon /> Add link
              </Button>
            }
          />
          {initialContent.guideLinks.length === 0 ? (
            <EmptyState>No guide links have been added.</EmptyState>
          ) : (
            <div className="divide-y border-y">
              {initialContent.guideLinks.map((link) => (
                <article
                  key={link.id}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{link.title}</h3>
                      <StatusBadge status={link.status} />
                      <Badge variant="outline" className="rounded-md">
                        {link.category}
                      </Badge>
                    </div>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm text-primary hover:underline"
                    >
                      {link.href}
                      <ExternalLinkIcon className="size-3.5 shrink-0" />
                    </a>
                  </div>
                  <ContentActions
                    archived={link.status === "archived"}
                    onEdit={() => setEditor({ kind: "guide", item: link })}
                    onArchive={() =>
                      archive("Guide link", archiveLiveGuideLink, link.id)
                    }
                  />
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prizes" className="space-y-4">
          <SectionHeader
            title="Prizes"
            description="Publish prize values, eligibility, judging criteria, and sponsor details."
            action={
              <Button onClick={() => setEditor({ kind: "prize", item: null })}>
                <PlusIcon /> Add prize
              </Button>
            }
          />
          {initialContent.prizes.length === 0 ? (
            <EmptyState>No prizes have been added.</EmptyState>
          ) : (
            <div className="divide-y border-y">
              {initialContent.prizes.map((prize) => (
                <article
                  key={prize.id}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{prize.title}</h3>
                      <StatusBadge status={prize.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[prize.sponsor, prize.value]
                        .filter(Boolean)
                        .join(" · ") || "No sponsor or value set"}
                    </p>
                  </div>
                  <ContentActions
                    archived={prize.status === "archived"}
                    onEdit={() => setEditor({ kind: "prize", item: prize })}
                    onArchive={() =>
                      archive("Prize", archiveLivePrize, prize.id)
                    }
                  />
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setEditor(null);
        }}
      >
        <SheetContent
          className="w-full overflow-y-auto sm:max-w-3xl"
          aria-busy={isPending}
        >
          <SheetHeader className="pr-10">
            <SheetTitle>
              {editor?.item ? "Edit" : "Add"} {editor?.kind ?? "content"}
            </SheetTitle>
            <SheetDescription>
              Drafts stay organizer-only. Published content appears on the live
              site after saving.
            </SheetDescription>
          </SheetHeader>
          <div className={isPending ? "pointer-events-none opacity-60" : ""}>
            {editor?.kind === "event" ? (
              <EventEditor
                item={editor.item}
                onResult={handleResult}
                timezone={initialContent.settings.timezone}
              />
            ) : editor?.kind === "announcement" ? (
              <AnnouncementEditor
                item={editor.item}
                onResult={handleResult}
                timezone={initialContent.settings.timezone}
              />
            ) : editor?.kind === "guide" ? (
              <GuideEditor item={editor.item} onResult={handleResult} />
            ) : editor?.kind === "prize" ? (
              <PrizeEditor item={editor.item} onResult={handleResult} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
