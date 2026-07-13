"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  FlagIcon,
  HistoryIcon,
  InboxIcon,
  ListFilterIcon,
  SearchIcon,
  TrophyIcon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  getApplicationReviewEvents,
  getApplicationReviewResumeUrl,
  markApplicationReviewed,
  saveApplicationReviewDraft,
} from "@/lib/actions/application-review.server.actions";
import { createClient } from "@/lib/supabase/client";
import {
  reviewCompleteSchema,
  reviewDraftSchema,
  type ReviewCounts,
  type ReviewDraftInput,
  type ReviewEventRecord,
  type ReviewListItem,
  type ReviewRecord,
} from "@/lib/types/application-reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import ThemeToggle from "./theme-toggle";

type DashboardData = {
  currentUser: {
    id: string;
    email: string;
    role: "hacker" | "organizer";
  };
  items: ReviewListItem[];
  counts: ReviewCounts;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type StatusFilter = "all" | "pending" | "reviewed" | "flagged";
type MobileView = "list" | "detail";

const DESKTOP_BREAKPOINT = 1024;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT,
  );

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

type PresenceMeta = {
  userId: string;
  email: string;
  onlineAt: string;
};

const EFFORT_DESCRIPTIONS: Record<number, string> = {
  1: "Generic answer, unclear why they want to attend",
  2: "Some interest but mostly vague",
  3: "Clear interest in attending and learning",
  4: "Strong enthusiasm with specific reasons",
  5: "Exceptional passion and strong alignment with the hackathon",
};

const BUILDER_DESCRIPTIONS: Record<number, string> = {
  1: "No evidence of building projects",
  2: "Limited coursework examples only",
  3: "Some personal or academic projects",
  4: "Multiple projects or hackathon experience",
  5: "Strong portfolio, startups, open source, or significant projects",
};

function emptyReviewDefaults(applicationId: string): ReviewDraftInput {
  return {
    applicationId,
    effortRating: null,
    builderRating: null,
    flaggedForReview: false,
    reviewComments: null,
  };
}

function toReviewDefaults(item: ReviewListItem | undefined): ReviewDraftInput {
  if (!item) return emptyReviewDefaults("");

  return {
    applicationId: item.application.id,
    effortRating: item.review?.effortRating ?? null,
    builderRating: item.review?.builderRating ?? null,
    flaggedForReview: item.review?.flaggedForReview ?? false,
    reviewComments: item.review?.reviewComments ?? null,
  };
}

function normalizeReviewValues(values: ReviewDraftInput): ReviewDraftInput {
  const reviewComments =
    values.flaggedForReview && values.reviewComments?.trim()
      ? values.reviewComments.trim()
      : null;

  return {
    ...values,
    reviewComments,
  };
}

function getCounts(items: ReviewListItem[]): ReviewCounts {
  return items.reduce<ReviewCounts>(
    (counts, item) => {
      counts.total += 1;
      counts[item.application.status] += 1;
      return counts;
    },
    { total: 0, pending: 0, reviewed: 0, flagged: 0 },
  );
}

function applicantName(item: ReviewListItem) {
  const name =
    `${item.application.firstName} ${item.application.lastName}`.trim();
  return name || item.application.applicantEmail || "Unnamed applicant";
}

function statusLabel(status: ReviewListItem["application"]["status"]) {
  if (status === "reviewed") return "Reviewed";
  if (status === "flagged") return "Flagged";
  return "Pending";
}

function statusClassName(status: ReviewListItem["application"]["status"]) {
  if (status === "reviewed") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/50 dark:text-green-300";
  }
  if (status === "flagged") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

const REVIEW_EVENT_FIELD_LABELS: Record<string, string> = {
  effortRating: "Effort",
  builderRating: "Builder",
  flaggedForReview: "Flag",
  reviewComments: "Comments",
  reviewedAt: "Reviewed time",
};

function reviewEventLabel(eventType: ReviewEventRecord["eventType"]) {
  if (eventType === "review_completed") return "Marked reviewed";
  return "Saved draft";
}

function formatReviewEventValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" && value.length > 48) {
    return `${value.slice(0, 48)}...`;
  }
  return String(value);
}

function describeReviewEventChanges(event: ReviewEventRecord) {
  const entries = Object.entries(event.changes);
  if (entries.length === 0) return "No field changes";

  return entries
    .map(([field, change]) => {
      const label = REVIEW_EVENT_FIELD_LABELS[field] ?? field;
      return `${label}: ${formatReviewEventValue(change.from)} -> ${formatReviewEventValue(change.to)}`;
    })
    .join("; ");
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "")
    return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function externalHref(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function MetaItem({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card px-3 py-2">
      <dt className="font-red-hat text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate font-red-hat text-sm font-medium text-foreground">
        {displayValue(value)}
      </dd>
    </div>
  );
}

function EssayBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="font-red-hat text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 whitespace-pre-wrap font-red-hat text-sm leading-6 text-foreground">
        {displayValue(value)}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
  dense = false,
}: {
  title: string;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-red-hat text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <dl
        className={
          dense ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"
        }
      >
        {children}
      </dl>
    </section>
  );
}

function RatingDescription({
  value,
  descriptions,
}: {
  value: number | null;
  descriptions: Record<number, string>;
}) {
  if (!value || !descriptions[value]) return null;

  return (
    <p className="rounded-lg border border-moss/15 bg-moss/5 px-3 py-2 text-xs leading-5 text-moss dark:border-sage/20 dark:bg-sage/10 dark:text-sage">
      {value}: {descriptions[value]}
    </p>
  );
}

function RatingPicker({
  value,
  onChange,
  invalid,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  invalid?: boolean;
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value?.toString() ?? ""}
      onValueChange={(nextValue) =>
        onChange(nextValue ? Number(nextValue) : null)
      }
      variant="outline"
      className="grid w-full grid-cols-5"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <ToggleGroupItem
          key={rating}
          value={rating.toString()}
          aria-label={`${label}: ${rating}`}
          aria-invalid={invalid}
          className={cn(
            "h-10 rounded-none border-l-0 bg-card text-base text-foreground first:rounded-l-lg first:border-l last:rounded-r-lg",
            "hover:bg-moss/10 hover:text-moss dark:hover:bg-sage/10 dark:hover:text-sage",
            "data-[state=on]:border-moss data-[state=on]:bg-moss data-[state=on]:text-white data-[state=on]:shadow-sm",
            "dark:data-[state=on]:border-sage dark:data-[state=on]:bg-sage dark:data-[state=on]:text-night",
            "data-[state=on]:hover:bg-moss data-[state=on]:hover:text-white dark:data-[state=on]:hover:bg-sage dark:data-[state=on]:hover:text-night",
            "focus-visible:z-10",
          )}
        >
          {rating}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function ReviewBadge({ review }: { review: ReviewRecord | null }) {
  if (!review?.reviewedAt) return null;

  return (
    <span className="text-xs text-muted-foreground">
      by {review.reviewerEmail ?? "organizer"}
    </span>
  );
}

function ReviewHistory({
  events,
  loading,
}: {
  events: ReviewEventRecord[];
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HistoryIcon className="size-4 text-moss dark:text-sage" />
          Edit history
        </div>
        {loading && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </div>

      {!loading && events.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No review edits logged yet.
        </p>
      )}

      {events.length > 0 && (
        <ol className="mt-3 space-y-3">
          {events.slice(0, 8).map((event) => (
            <li key={event.id} className="border-l pl-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="font-medium text-foreground">
                  {reviewEventLabel(event.eventType)}
                </span>
                <span className="text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                by {event.reviewerEmail ?? "organizer"}
              </p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-foreground">
                {describeReviewEventChanges(event)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ResumePreview({
  resumeKey,
  resumeUrl,
  loading,
}: {
  resumeKey: string | null;
  resumeUrl: string | null;
  loading: boolean;
}) {
  if (!resumeKey) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
        No resume uploaded.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Loading resume preview...
      </div>
    );
  }

  if (!resumeUrl) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        <FileTextIcon className="size-5" />
        Could not load a preview. Stored key: {resumeKey}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <FileTextIcon className="size-4 shrink-0 text-moss dark:text-sage" />
          <span className="truncate">Resume preview</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={resumeUrl} target="_blank" rel="noreferrer">
            <DownloadIcon className="size-3.5" />
            Open
          </a>
        </Button>
      </div>
      <iframe
        title="Resume preview"
        src={resumeUrl}
        className="pointer-events-none h-[320px] w-full bg-white dark:bg-zinc-950"
      />
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string | null | undefined;
  label: string;
  icon?: React.ReactNode;
}) {
  if (!href) return null;

  return (
    <Button asChild variant="outline" size="sm" className="bg-card">
      <a href={href} target="_blank" rel="noreferrer">
        {icon ?? <ExternalLinkIcon className="size-3.5" />}
        {label}
      </a>
    </Button>
  );
}

export default function ApplicationReviewWorkspace({
  initialData,
}: {
  initialData: DashboardData;
}) {
  const initialSelectedItem =
    initialData.items.find((item) => item.application.status === "pending") ??
    initialData.items[0];
  const [items, setItems] = useState(initialData.items);
  const [selectedId, setSelectedId] = useState(
    initialSelectedItem?.application.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isCompleting, setIsCompleting] = useState(false);
  const isDesktop = useIsDesktop();
  const [activeReviewers, setActiveReviewers] = useState<PresenceMeta[]>([]);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [reviewEvents, setReviewEvents] = useState<ReviewEventRecord[]>([]);
  const [reviewEventsLoading, setReviewEventsLoading] = useState(false);
  const selectedIdRef = useRef(selectedId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(false);
  const saveSequence = useRef(0);

  const selectedItem = useMemo(
    () => items.find((item) => item.application.id === selectedId),
    [items, selectedId],
  );

  const form = useForm<ReviewDraftInput>({
    resolver: zodResolver(reviewDraftSchema),
    mode: "onChange",
    defaultValues: toReviewDefaults(initialSelectedItem),
  });

  const effortRating = form.watch("effortRating");
  const builderRating = form.watch("builderRating");
  const flaggedForReview = form.watch("flaggedForReview");

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (isDesktop) setScorecardOpen(false);
  }, [isDesktop]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const statusItems =
      statusFilter === "all"
        ? items
        : items.filter((item) => item.application.status === statusFilter);
    if (!needle) return statusItems;

    return statusItems.filter((item) => {
      const haystack = [
        applicantName(item),
        item.application.applicantEmail,
        item.application.university,
        item.application.major,
        item.application.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, statusFilter]);

  const counts = useMemo(() => getCounts(items), [items]);
  const completedCount = counts.reviewed + counts.flagged;
  const completionPercent =
    counts.total === 0 ? 0 : Math.round((completedCount / counts.total) * 100);

  function updateReviewItem(
    applicationId: string,
    review: ReviewRecord,
    status?: ReviewListItem["application"]["status"],
  ) {
    setItems((current) =>
      current.map((item) =>
        item.application.id === applicationId
          ? {
              ...item,
              application: {
                ...item.application,
                status: status ?? item.application.status,
              },
              review,
            }
          : item,
      ),
    );
  }

  function appendReviewEvent(event: ReviewEventRecord | null) {
    if (!event || event.applicationId !== selectedIdRef.current) return;
    setReviewEvents((current) => [
      event,
      ...current.filter((item) => item.id !== event.id),
    ]);
  }

  function selectApplication(item: ReviewListItem) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    skipNextAutosave.current = true;
    setSelectedId(item.application.id);
    setMobileView("detail");
    setScorecardOpen(false);
    setSaveStatus("idle");
    setResumeUrl(null);
    form.reset(toReviewDefaults(item));
    window.setTimeout(() => {
      skipNextAutosave.current = false;
    }, 0);
  }

  useEffect(() => {
    // react-hook-form's watch() subscription cannot be memoized by React Compiler.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((rawValues) => {
      if (skipNextAutosave.current || !rawValues.applicationId) return;
      const values = normalizeReviewValues(rawValues as ReviewDraftInput);
      const parsed = reviewDraftSchema.safeParse(values);

      if (!parsed.success) {
        setSaveStatus("error");
        return;
      }

      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      const sequence = saveSequence.current + 1;
      saveSequence.current = sequence;
      setSaveStatus("saving");

      saveTimer.current = setTimeout(async () => {
        try {
          const result = await saveApplicationReviewDraft(parsed.data);
          if (saveSequence.current !== sequence) return;
          updateReviewItem(parsed.data.applicationId, result.review);
          appendReviewEvent(result.event);
          setSaveStatus("saved");
          savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
        } catch (error) {
          console.error("Review autosave failed:", error);
          setSaveStatus("error");
        }
      }, 900);
    });

    return () => {
      subscription.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [form]);

  useEffect(() => {
    if (!selectedItem?.application.resume) {
      setResumeUrl(null);
      setResumeLoading(false);
      return;
    }

    let ignore = false;
    setResumeLoading(true);
    setResumeUrl(null);

    getApplicationReviewResumeUrl(selectedItem.application.id)
      .then((url) => {
        if (!ignore) setResumeUrl(url);
      })
      .catch((error) => {
        console.error("Unable to load resume URL:", error);
        if (!ignore) setResumeUrl(null);
      })
      .finally(() => {
        if (!ignore) setResumeLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedItem?.application.id, selectedItem?.application.resume]);

  useEffect(() => {
    if (!selectedId) {
      setReviewEvents([]);
      setReviewEventsLoading(false);
      return;
    }

    let ignore = false;
    setReviewEvents([]);
    setReviewEventsLoading(true);

    getApplicationReviewEvents(selectedId)
      .then((events) => {
        if (!ignore) setReviewEvents(events);
      })
      .catch((error) => {
        console.error("Unable to load review history:", error);
        if (!ignore) setReviewEvents([]);
      })
      .finally(() => {
        if (!ignore) setReviewEventsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const supabase = createClient();
    const channel = supabase.channel(`application-review:${selectedId}`, {
      config: { presence: { key: initialData.currentUser.id } },
    });

    const syncPresence = () => {
      const state = channel.presenceState() as Record<string, PresenceMeta[]>;
      const reviewers = Object.values(state)
        .flat()
        .filter((meta) => meta.userId !== initialData.currentUser.id);
      setActiveReviewers(reviewers);
    };

    channel.on("presence", { event: "sync" }, syncPresence);
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: initialData.currentUser.id,
          email: initialData.currentUser.email,
          onlineAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      setActiveReviewers([]);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [initialData.currentUser.email, initialData.currentUser.id, selectedId]);

  async function handleMarkReviewed() {
    const values = normalizeReviewValues(form.getValues());
    const parsed = reviewCompleteSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "effortRating" || field === "builderRating") {
          form.setError(field, { message: issue.message });
        }
      }
      toast.error("Add both 1-5 ratings before marking reviewed.");
      return;
    }

    setIsCompleting(true);
    try {
      const result = await markApplicationReviewed(parsed.data);
      updateReviewItem(parsed.data.applicationId, result.review, result.status);
      appendReviewEvent(result.event);
      setScorecardOpen(false);
      toast.success("Application marked reviewed.");
    } catch (error) {
      console.error("Unable to complete review:", error);
      toast.error("Unable to mark reviewed. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b bg-card/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss/55 dark:text-sage/60">
                  MHacks Organizer
                </p>
                <h1 className="font-heading text-2xl italic tracking-tight text-moss sm:text-3xl dark:text-sage">
                  Application Review
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2 lg:hidden">
                <Button asChild variant="outline" size="sm" className="bg-card">
                  <Link href="/admin/applications/leaderboard">
                    <TrophyIcon className="size-4" />
                    <span className="sr-only">Leaderboard</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="bg-card">
                  <Link href="/admin/applications/analytics">
                    <BarChart3Icon className="size-4" />
                    <span className="sr-only">Analytics</span>
                  </Link>
                </Button>
                <ThemeToggle />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                <Stat
                  label="Done"
                  value={`${completedCount}/${counts.total}`}
                />
                <Stat label="Pending" value={counts.pending} />
                <Stat label="Reviewed" value={counts.reviewed} />
                <Stat label="Flagged" value={counts.flagged} />
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <Button asChild variant="outline" size="sm" className="bg-card">
                  <Link href="/admin/applications/leaderboard">
                    <TrophyIcon className="size-4" />
                    Leaderboard
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="bg-card">
                  <Link href="/admin/applications/analytics">
                    <BarChart3Icon className="size-4" />
                    Analytics
                  </Link>
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-moss/10 dark:bg-sage/10">
            <div
              className="h-full rounded-full bg-moss transition-all dark:bg-sage"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t bg-card lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(300px,360px)]">
          <aside
            className={cn(
              "min-h-0 min-w-0 flex-col border-r bg-card",
              mobileView === "list" ? "flex" : "hidden",
              "lg:flex",
            )}
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <InboxIcon className="size-4 text-moss dark:text-sage" />
                <h2 className="text-sm font-semibold">Applications</h2>
              </div>
              <Badge variant="outline">{filteredItems.length}</Badge>
            </div>
            <div className="space-y-3 border-b p-3">
              <Tabs
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="reviewed">Done</TabsTrigger>
                  <TabsTrigger value="flagged">Flagged</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search applications"
                  className="pl-8"
                />
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No applications match this view.
                </div>
              ) : (
                <div className="divide-y">
                  {filteredItems.map((item) => {
                    const active = item.application.id === selectedId;
                    return (
                      <button
                        key={item.application.id}
                        type="button"
                        onClick={() => selectApplication(item)}
                        className={cn(
                          "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                          active && "bg-muted hover:bg-muted",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold">
                            {applicantName(item)}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {new Date(
                              item.application.createdAt,
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={statusClassName(item.application.status)}
                          >
                            {statusLabel(item.application.status)}
                          </Badge>
                          {item.review?.flaggedForReview && (
                            <FlagIcon className="size-3.5 text-amber-600" />
                          )}
                          <ReviewBadge review={item.review} />
                        </div>
                        <p className="mt-2 truncate text-xs font-medium">
                          {item.application.university} ·{" "}
                          {item.application.major}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.application.whyMhacks}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </aside>

          <section
            className={cn(
              "min-h-0 min-w-0 flex-col overflow-hidden border-r bg-muted/30",
              mobileView === "detail" ? "flex" : "hidden",
              "lg:flex",
            )}
          >
            <div className="flex h-14 items-center justify-between gap-2 border-b bg-card px-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 lg:hidden"
                  onClick={() => {
                    setScorecardOpen(false);
                    setMobileView("list");
                  }}
                  aria-label="Back to applications"
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <ListFilterIcon className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
                <span className="truncate text-sm font-medium">
                  {selectedItem
                    ? `${applicantName(selectedItem)} application`
                    : "Select an application"}
                </span>
              </div>
              {selectedItem && (
                <Badge
                  variant="outline"
                  className={statusClassName(selectedItem.application.status)}
                >
                  {statusLabel(selectedItem.application.status)}
                </Badge>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!selectedItem ? (
                <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                  Select an application to review.
                </div>
              ) : (
                <div className="mx-auto w-full max-w-3xl space-y-7 p-4 pb-28 sm:p-5 md:p-6 lg:pb-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-3xl italic tracking-tight text-moss sm:text-4xl dark:text-sage">
                          {applicantName(selectedItem)}
                        </h2>
                        <Badge
                          variant="outline"
                          className={statusClassName(
                            selectedItem.application.status,
                          )}
                        >
                          {statusLabel(selectedItem.application.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedItem.application.applicantEmail ??
                          "No applicant email"}{" "}
                        · submitted{" "}
                        {new Date(
                          selectedItem.application.createdAt,
                        ).toLocaleDateString()}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <QuickLink
                          href={
                            selectedItem.application.applicantEmail
                              ? `mailto:${selectedItem.application.applicantEmail}`
                              : null
                          }
                          label="Email"
                        />
                        <QuickLink
                          href={resumeUrl}
                          label="Resume"
                          icon={<FileTextIcon className="size-3.5" />}
                        />
                        <QuickLink
                          href={externalHref(selectedItem.application.github)}
                          label="GitHub"
                        />
                        <QuickLink
                          href={externalHref(selectedItem.application.linkedin)}
                          label="LinkedIn"
                        />
                        <QuickLink
                          href={externalHref(
                            selectedItem.application.personalSite,
                          )}
                          label="Website"
                        />
                      </div>
                    </div>
                    {activeReviewers.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
                        <div className="flex items-center gap-2 font-medium">
                          <EyeIcon className="size-4" />
                          Currently viewing
                        </div>
                        <p className="mt-1 text-xs">
                          {activeReviewers
                            .map((reviewer) => reviewer.email)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                  </div>

                  <ResumePreview
                    resumeKey={selectedItem.application.resume}
                    resumeUrl={resumeUrl}
                    loading={resumeLoading}
                  />

                  <Section title="Applicant Snapshot" dense>
                    <MetaItem
                      label="Age"
                      value={selectedItem.application.age}
                    />
                    <MetaItem
                      label="Gender"
                      value={selectedItem.application.gender}
                    />
                    <MetaItem
                      label="Ethnicity"
                      value={selectedItem.application.ethnicity}
                    />
                    <MetaItem
                      label="Phone"
                      value={selectedItem.application.phoneNumber}
                    />
                  </Section>

                  <Section title="Academic Snapshot" dense>
                    <MetaItem
                      label="University"
                      value={selectedItem.application.university}
                    />
                    <MetaItem
                      label="Major"
                      value={selectedItem.application.major}
                    />
                    <MetaItem
                      label="Degree"
                      value={selectedItem.application.degree}
                    />
                    <MetaItem
                      label="Graduation year"
                      value={selectedItem.application.graduationYear}
                    />
                    <MetaItem
                      label="Previous hackathons"
                      value={selectedItem.application.previousHackathons}
                    />
                    <MetaItem
                      label="Country"
                      value={selectedItem.application.country}
                    />
                  </Section>

                  <Section title="Essays">
                    <EssayBlock
                      label="Why MHacks?"
                      value={selectedItem.application.whyMhacks}
                    />
                    <EssayBlock
                      label="Funding prompt"
                      value={selectedItem.application.whatWouldYouDo}
                    />
                    <EssayBlock
                      label="Hill to die on"
                      value={selectedItem.application.hillToDieOn}
                    />
                    <EssayBlock
                      label="Anything else"
                      value={selectedItem.application.anythingElse}
                    />
                  </Section>

                  <Section title="Logistics" dense>
                    <MetaItem
                      label="Transportation"
                      value={selectedItem.application.transportationType}
                    />
                    <MetaItem
                      label="Coming from"
                      value={selectedItem.application.comingFrom}
                    />
                    <MetaItem
                      label="Airport"
                      value={selectedItem.application.airportCode}
                    />
                    <MetaItem
                      label="Shirt size"
                      value={selectedItem.application.shirtSize}
                    />
                    <MetaItem
                      label="Allergies/restrictions"
                      value={selectedItem.application.allergiesDescription}
                    />
                    <MetaItem
                      label="Needs reimbursement"
                      value={selectedItem.application.needsTravelReimbursement}
                    />
                    <MetaItem
                      label="Would attend without reimbursement"
                      value={
                        selectedItem.application.wouldAttendWithoutReimbursement
                      }
                    />
                  </Section>
                </div>
              )}
            </div>

            {selectedItem && (
              <div className="shrink-0 border-t bg-card/95 px-3 pt-3 backdrop-blur supports-backdrop-filter:bg-card/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {saveStatus === "saving" && "Saving..."}
                      {saveStatus === "saved" && "Saved"}
                      {saveStatus === "error" && "Check ratings"}
                      {saveStatus === "idle" && "Autosaves as you score"}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {effortRating ?? "—"} · {builderRating ?? "—"}
                      {flaggedForReview ? " · Flagged" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="h-11 shrink-0 bg-moss px-5 text-white hover:bg-moss/90 dark:bg-sage dark:text-night dark:hover:bg-sage/90"
                    onClick={() => setScorecardOpen(true)}
                  >
                    <ClipboardCheckIcon className="size-4" />
                    Score
                  </Button>
                </div>
              </div>
            )}
          </section>

          <aside className="hidden min-h-0 min-w-0 flex-col bg-card lg:flex">
            {isDesktop ? (
              <ScrollArea className="min-h-0 flex-1">
                <ScorecardForm
                  form={form}
                  effortRating={effortRating}
                  builderRating={builderRating}
                  flaggedForReview={flaggedForReview}
                  saveStatus={saveStatus}
                  selectedItem={selectedItem}
                  reviewEvents={reviewEvents}
                  reviewEventsLoading={reviewEventsLoading}
                  activeReviewers={activeReviewers}
                  currentUserEmail={initialData.currentUser.email}
                  isCompleting={isCompleting}
                  onMarkReviewed={handleMarkReviewed}
                />
              </ScrollArea>
            ) : null}
          </aside>
        </div>

        {!isDesktop && (
          <Drawer open={scorecardOpen} onOpenChange={setScorecardOpen}>
            <DrawerContent className="max-h-[92vh]">
              <DrawerHeader className="border-b text-left">
                <DrawerTitle className="font-heading text-2xl italic text-moss dark:text-sage">
                  Scorecard
                </DrawerTitle>
                <DrawerDescription>
                  {selectedItem
                    ? `Reviewing ${applicantName(selectedItem)}`
                    : "Autosaves while you work."}
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                {scorecardOpen ? (
                  <ScorecardForm
                    form={form}
                    effortRating={effortRating}
                    builderRating={builderRating}
                    flaggedForReview={flaggedForReview}
                    saveStatus={saveStatus}
                    selectedItem={selectedItem}
                    reviewEvents={reviewEvents}
                    reviewEventsLoading={reviewEventsLoading}
                    activeReviewers={activeReviewers}
                    currentUserEmail={initialData.currentUser.email}
                    isCompleting={isCompleting}
                    onMarkReviewed={handleMarkReviewed}
                    compact
                  />
                ) : null}
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </main>
  );
}

function ScorecardForm({
  form,
  effortRating,
  builderRating,
  flaggedForReview,
  saveStatus,
  selectedItem,
  reviewEvents,
  reviewEventsLoading,
  activeReviewers,
  currentUserEmail,
  isCompleting,
  onMarkReviewed,
  compact = false,
}: {
  form: UseFormReturn<ReviewDraftInput>;
  effortRating: number | null;
  builderRating: number | null;
  flaggedForReview: boolean;
  saveStatus: SaveStatus;
  selectedItem: ReviewListItem | undefined;
  reviewEvents: ReviewEventRecord[];
  reviewEventsLoading: boolean;
  activeReviewers: PresenceMeta[];
  currentUserEmail: string;
  isCompleting: boolean;
  onMarkReviewed: () => void;
  compact?: boolean;
}) {
  return (
    <form
      className={cn("space-y-5", compact ? "p-4" : "p-5")}
      onSubmit={(event) => event.preventDefault()}
    >
      {!compact && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss/55 dark:text-sage/60">
            Review
          </p>
          <h2 className="font-heading text-3xl italic text-moss dark:text-sage">
            Scorecard
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Autosaves while you work. Use Mark reviewed when the review is
            complete.
          </p>
        </div>
      )}

      {!compact && <Separator />}

      <div className="space-y-2">
        <Label htmlFor="effortRating">Effort / Motivation / Interest</Label>
        <Controller
          control={form.control}
          name="effortRating"
          render={({ field }) => (
            <RatingPicker
              value={field.value}
              onChange={field.onChange}
              invalid={!!form.formState.errors.effortRating}
              label="Effort / Motivation / Interest"
            />
          )}
        />
        {form.formState.errors.effortRating && (
          <p className="text-xs text-destructive">
            {form.formState.errors.effortRating.message}
          </p>
        )}
        <RatingDescription
          value={effortRating}
          descriptions={EFFORT_DESCRIPTIONS}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="builderRating">
          Builder Mindset / Initiative / Vibe
        </Label>
        <Controller
          control={form.control}
          name="builderRating"
          render={({ field }) => (
            <RatingPicker
              value={field.value}
              onChange={field.onChange}
              invalid={!!form.formState.errors.builderRating}
              label="Builder Mindset / Initiative / Vibe"
            />
          )}
        />
        {form.formState.errors.builderRating && (
          <p className="text-xs text-destructive">
            {form.formState.errors.builderRating.message}
          </p>
        )}
        <RatingDescription
          value={builderRating}
          descriptions={BUILDER_DESCRIPTIONS}
        />
      </div>

      <Controller
        control={form.control}
        name="flaggedForReview"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <Checkbox
              checked={field.value}
              onCheckedChange={(value) => {
                const checked = value === true;
                field.onChange(checked);
                if (!checked) {
                  form.setValue("reviewComments", null, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }
              }}
            />
            <span className="flex items-center gap-2">
              <FlagIcon className="size-4 text-amber-600 dark:text-amber-300" />
              Flag for review
            </span>
          </label>
        )}
      />

      {flaggedForReview && (
        <div className="space-y-2">
          <Label htmlFor="reviewComments">Flag comments</Label>
          <Controller
            control={form.control}
            name="reviewComments"
            render={({ field }) => (
              <Textarea
                id="reviewComments"
                rows={compact ? 4 : 6}
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value)}
                placeholder="Why should this application get another look?"
              />
            )}
          />
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Save status</span>
          <span
            className={cn(
              "font-medium",
              saveStatus === "error" && "text-destructive",
              saveStatus === "saved" && "text-green-700 dark:text-green-300",
              saveStatus === "saving" && "text-moss dark:text-sage",
            )}
          >
            {saveStatus === "idle" && "Idle"}
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Check ratings"}
          </span>
        </div>
        {selectedItem?.review?.reviewedAt && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-300" />
            Reviewed {new Date(selectedItem.review.reviewedAt).toLocaleString()}{" "}
            by {selectedItem.review.reviewerEmail ?? "organizer"}
          </div>
        )}
      </div>

      <ReviewHistory events={reviewEvents} loading={reviewEventsLoading} />

      {activeReviewers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangleIcon className="size-4" />
            Another organizer is here
          </div>
          <p className="mt-1 text-xs">
            {activeReviewers.map((reviewer) => reviewer.email).join(", ")}
          </p>
        </div>
      )}

      <Button
        type="button"
        onClick={onMarkReviewed}
        disabled={!selectedItem || isCompleting}
        className="h-11 w-full bg-moss text-white hover:bg-moss/90 dark:bg-sage dark:text-night dark:hover:bg-sage/90"
      >
        {isCompleting
          ? "Marking reviewed..."
          : selectedItem?.review?.reviewedAt
            ? "Update reviewed"
            : "Mark reviewed"}
      </Button>

      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
        <UserRoundIcon className="size-4" />
        Signed in as {currentUserEmail}
      </div>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-moss dark:text-sage">{value}</p>
    </div>
  );
}
