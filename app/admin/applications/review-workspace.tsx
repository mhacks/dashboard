"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useDefaultLayout, type LayoutStorage } from "react-resizable-panels";
import {
  Controller,
  useForm,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  FlagIcon,
  InboxIcon,
  ListFilterIcon,
  RefreshCwIcon,
  SearchIcon,
  SmartphoneIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  getApplicationReviewEvents,
  getApplicationReviewDetail,
  markApplicationReviewed,
} from "@/lib/actions/application-review.server.actions";
import { getResumeDownloadUrl } from "@/lib/actions/resume.server.actions";
import { createClient } from "@/lib/supabase/client";
import {
  reviewCompleteSchema,
  reviewDraftSchema,
  reviewSyncPayloadSchema,
  type ReviewCounts,
  type ReviewSyncPayload,
  type ReviewWorkspaceData,
  type ReviewDraftInput,
  type ReviewEventRecord,
  type ReviewListItem,
  type ReviewListSummaryItem,
  type ReviewRecord,
} from "@/lib/types/application-reviews";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { clampPageIndex, getPageCount, paginateSlice } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { ApplicationReviewHeader } from "./components/application-review-header";
import { ListPagination } from "./components/list-pagination";
import { Meter } from "./components/meter";
import {
  applicationStatusLabel,
  formatReviewDisplayValue,
} from "./display-formatters";
import { ReviewEventTimeline } from "./review-event-timeline";

type Organizer = { id: string; email: string };

type StatusFilter = "all" | "pending" | "reviewed" | "flagged";
type MobileView = "list" | "detail";
type SupabaseBrowserClient = ReturnType<typeof createClient>;
type ReviewSyncChannel = ReturnType<SupabaseBrowserClient["channel"]>;

const DESKTOP_BREAKPOINT = 1024;
const APPLICATIONS_PAGE_SIZE = 25;
// Keep in sync with RESUME_DOWNLOAD_URL_TTL_SECONDS in resume.server.actions.ts
const RESUME_PREVIEW_URL_TTL_MS = 15 * 60 * 1000;
const PHONE_LANDSCAPE_QUERY =
  "(orientation: landscape) and (max-height: 520px) and (max-width: 950px) and (pointer: coarse)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

function useIsPhoneLandscape() {
  const [isPhoneLandscape, setIsPhoneLandscape] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(PHONE_LANDSCAPE_QUERY);
    const onChange = () => setIsPhoneLandscape(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isPhoneLandscape;
}

type PresenceMeta = {
  userId: string;
  email: string;
  onlineAt: string;
};

const REVIEW_WORKSPACE_PANEL_IDS = [
  "applications-list",
  "application-detail",
  "scorecard",
] as const;
const REVIEW_SYNC_CHANNEL = "application-review:dashboard";
const REVIEW_SYNC_EVENT = "review_updated";

const PANEL_LAYOUT_STORAGE: LayoutStorage = {
  getItem(key) {
    try {
      return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  },
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

function toReviewDefaults(
  item: ReviewListItem | ReviewListSummaryItem | undefined,
): ReviewDraftInput {
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

function getCounts(items: ReviewListSummaryItem[]): ReviewCounts {
  return items.reduce<ReviewCounts>(
    (counts, item) => {
      counts.total += 1;
      counts[item.application.status] += 1;
      return counts;
    },
    { total: 0, pending: 0, reviewed: 0, flagged: 0 },
  );
}

function applicantName(item: ReviewListSummaryItem | ReviewListItem) {
  const name =
    `${item.application.firstName} ${item.application.lastName}`.trim();
  return name || item.application.applicantEmail || "Unnamed applicant";
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

function ReviewBadge({ review }: { review: ReviewRecord | null }) {
  if (!review?.reviewedAt) return null;

  return (
    <span className="text-xs text-muted-foreground">
      by {review.reviewerEmail ?? "organizer"}
    </span>
  );
}

function displayValue(value: unknown) {
  return formatReviewDisplayValue(value);
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
    <div className="grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[minmax(9rem,34%)_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">
        {displayValue(value)}
      </dd>
    </div>
  );
}

function EssayBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="py-4">
      <dt className="text-sm font-medium text-foreground">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {displayValue(value)}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-red-hat text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <dl className="divide-y divide-border/60 rounded-lg border bg-card px-4 py-1">
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

function ResumePreview({
  resumeKey,
  resumeUrl,
  loading,
  expired,
  onRefresh,
  onOpen,
  refreshing,
}: {
  resumeKey: string | null;
  resumeUrl: string | null;
  loading: boolean;
  expired: boolean;
  onRefresh: () => void;
  onOpen: () => void;
  refreshing: boolean;
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onOpen()}
          disabled={refreshing || loading}
        >
          <DownloadIcon className="size-3.5" />
          Open
        </Button>
      </div>
      {expired ? (
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          className="flex h-[320px] w-full flex-col items-center justify-center gap-2 bg-muted/20 px-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-60"
        >
          <RefreshCwIcon
            className={cn("size-5", refreshing && "animate-spin")}
          />
          {refreshing
            ? "Refreshing preview..."
            : "Preview expired. Click to refresh."}
        </button>
      ) : (
        <iframe
          title="Resume preview"
          src={resumeUrl}
          sandbox=""
          referrerPolicy="no-referrer"
          className="pointer-events-none h-[320px] w-full bg-white dark:bg-zinc-950"
        />
      )}
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
  onClick,
}: {
  href?: string | null;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="bg-card"
        onClick={onClick}
      >
        {icon ?? <ExternalLinkIcon className="size-3.5" />}
        {label}
      </Button>
    );
  }

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
  initialData: ReviewWorkspaceData;
}) {
  const initialSelectedItem =
    initialData.items.find((item) => item.application.status === "pending") ??
    initialData.items[0];
  const [items, setItems] = useState(initialData.items);
  const [selectedId, setSelectedId] = useState(
    initialSelectedItem?.application.id ?? "",
  );
  const [selectedDetail, setSelectedDetail] = useState<
    ReviewListItem | undefined
  >(undefined);
  const [detailLoadedId, setDetailLoadedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [applicationsPage, setApplicationsPage] = useState(0);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [reviewConflict, setReviewConflict] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const isDesktop = useIsDesktop();
  const [activeReviewers, setActiveReviewers] = useState<PresenceMeta[]>([]);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeLoadedKey, setResumeLoadedKey] = useState<string | null>(null);
  const [resumeExpired, setResumeExpired] = useState(false);
  const [resumeRefreshing, setResumeRefreshing] = useState(false);
  const resumeExpiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reviewEvents, setReviewEvents] = useState<ReviewEventRecord[]>([]);
  const [reviewEventsLoadedId, setReviewEventsLoadedId] = useState<
    string | null
  >(null);
  const [pendingApplicationSwitch, setPendingApplicationSwitch] =
    useState<ReviewListSummaryItem | null>(null);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const selectedIdRef = useRef(selectedId);
  const serverUpdatedAt = useRef<string | null>(
    initialSelectedItem?.review?.updatedAt ?? null,
  );
  const reviewSyncChannel = useRef<ReviewSyncChannel | null>(null);

  const form = useForm<ReviewDraftInput>({
    resolver: zodResolver(reviewDraftSchema),
    mode: "onChange",
    defaultValues: emptyReviewDefaults(
      initialSelectedItem?.application.id ?? "",
    ),
  });
  const { reset: resetReviewForm } = form;

  const syncServerBaseline = useCallback(
    (review: ReviewRecord | null | undefined) => {
      serverUpdatedAt.current = review?.updatedAt ?? null;
      setReviewConflict(false);
    },
    [],
  );

  const applyReviewForm = useCallback(
    (item: ReviewListItem | ReviewListSummaryItem | undefined) => {
      resetReviewForm(toReviewDefaults(item));
      syncServerBaseline(item?.review);
    },
    [resetReviewForm, syncServerBaseline],
  );

  const markReviewConflict = useCallback(() => {
    setReviewConflict(true);
  }, []);

  const [effortRating, builderRating, flaggedForReview] = useWatch({
    control: form.control,
    name: ["effortRating", "builderRating", "flaggedForReview"],
  });
  const detailLoading = Boolean(selectedId) && detailLoadedId !== selectedId;
  const reviewEventsLoading =
    Boolean(selectedId) && reviewEventsLoadedId !== selectedId;
  const isPhoneLandscape = useIsPhoneLandscape();
  const panelLayout = useDefaultLayout({
    id: "application-review-workspace",
    panelIds: [...REVIEW_WORKSPACE_PANEL_IDS],
    storage: PANEL_LAYOUT_STORAGE,
  });

  useEffect(() => {
    let cancelled = false;

    async function syncSession(session: Session | null) {
      if (!session?.access_token) {
        await supabase.realtime.setAuth(null);
        if (cancelled) return;
        setOrganizer(null);
        setRealtimeReady(false);
        return;
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (cancelled || error || !user) {
        await supabase.realtime.setAuth(null);
        setOrganizer(null);
        setRealtimeReady(false);
        return;
      }

      setRealtimeReady(false);
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      setOrganizer({ id: user.id, email: user.email ?? "" });
      setRealtimeReady(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        void syncSession(session);
        return;
      }

      if (event === "SIGNED_OUT") {
        void syncSession(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const [prevIsDesktop, setPrevIsDesktop] = useState(isDesktop);
  if (isDesktop !== prevIsDesktop) {
    setPrevIsDesktop(isDesktop);
    if (isDesktop && scorecardOpen) {
      setScorecardOpen(false);
    }
  }

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
        item.application.whyMhacksPreview,
        item.application.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, statusFilter]);

  const pageCount = getPageCount(filteredItems.length, APPLICATIONS_PAGE_SIZE);
  const filterKey = `${query}|${statusFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setApplicationsPage(0);
  }

  const clampedApplicationsPage = clampPageIndex(applicationsPage, pageCount);
  if (clampedApplicationsPage !== applicationsPage) {
    setApplicationsPage(clampedApplicationsPage);
  }

  const paginatedItems = useMemo(
    () =>
      paginateSlice(
        filteredItems,
        clampedApplicationsPage,
        APPLICATIONS_PAGE_SIZE,
      ),
    [filteredItems, clampedApplicationsPage],
  );

  const counts = useMemo(() => getCounts(items), [items]);
  const completedCount = counts.reviewed + counts.flagged;
  const completionPercent =
    counts.total === 0 ? 0 : Math.round((completedCount / counts.total) * 100);

  const updateReviewItem = useCallback(
    (
      applicationId: string,
      review: ReviewRecord,
      status?: ReviewListItem["application"]["status"],
    ) => {
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
      setSelectedDetail((current) =>
        current?.application.id === applicationId
          ? {
              ...current,
              application: {
                ...current.application,
                status: status ?? current.application.status,
              },
              review,
            }
          : current,
      );
    },
    [],
  );

  const appendReviewEvent = useCallback((event: ReviewEventRecord | null) => {
    if (!event || event.applicationId !== selectedIdRef.current) return;
    setReviewEvents((current) => [
      event,
      ...current.filter((item) => item.id !== event.id),
    ]);
  }, []);

  const broadcastReviewUpdate = useCallback(
    async (payload: Omit<ReviewSyncPayload, "sourceUserId">) => {
      await reviewSyncChannel.current?.send({
        type: "broadcast",
        event: REVIEW_SYNC_EVENT,
        payload: {
          ...payload,
          sourceUserId: organizer?.id ?? "",
        },
      });
    },
    [organizer?.id],
  );

  function applyApplicationSwitch(item: ReviewListSummaryItem) {
    setSelectedId(item.application.id);
    setSelectedDetail(undefined);
    setMobileView("detail");
    setScorecardOpen(false);
    setResumeUrl(null);
    applyReviewForm(item);
  }

  function selectApplication(item: ReviewListSummaryItem) {
    if (item.application.id === selectedId) return;

    if (form.formState.isDirty) {
      setPendingApplicationSwitch(item);
      return;
    }

    applyApplicationSwitch(item);
  }

  function confirmApplicationSwitch() {
    if (!pendingApplicationSwitch) return;
    applyApplicationSwitch(pendingApplicationSwitch);
    setPendingApplicationSwitch(null);
  }

  useEffect(() => {
    if (!selectedId) return;

    let ignore = false;

    getApplicationReviewDetail(selectedId)
      .then((detail) => {
        if (!ignore) {
          setSelectedDetail(detail);
          if (!form.formState.isDirty) {
            applyReviewForm(detail);
          }
        }
      })
      .catch((error) => {
        console.error("Unable to load application detail:", error);
        if (!ignore) setSelectedDetail(undefined);
      })
      .finally(() => {
        if (!ignore) setDetailLoadedId(selectedId);
      });

    return () => {
      ignore = true;
    };
  }, [applyReviewForm, form.formState.isDirty, selectedId]);

  if (!selectedId) {
    if (selectedDetail !== undefined) setSelectedDetail(undefined);
    if (detailLoadedId !== null) setDetailLoadedId(null);
  }

  const [prevReviewEventsId, setPrevReviewEventsId] = useState(selectedId);
  if (selectedId !== prevReviewEventsId) {
    setPrevReviewEventsId(selectedId);
    if (reviewEvents.length > 0) setReviewEvents([]);
    if (reviewEventsLoadedId !== null) setReviewEventsLoadedId(null);
  }

  useEffect(() => {
    if (!realtimeReady || !organizer) return;

    let active = true;
    let channel: ReviewSyncChannel | null = null;

    channel = supabase.channel(REVIEW_SYNC_CHANNEL, {
      config: { private: true },
    });
    if (!active) {
      supabase.removeChannel(channel);
      return;
    }
    reviewSyncChannel.current = channel;

    channel.on("broadcast", { event: REVIEW_SYNC_EVENT }, ({ payload }) => {
      const parsed = reviewSyncPayloadSchema.safeParse(payload);
      if (!parsed.success) return;

      const update = parsed.data;
      if (update.sourceUserId === organizer.id) return;
      if (!update.status) return;

      updateReviewItem(update.applicationId, update.review, update.status);

      if (update.applicationId !== selectedIdRef.current) return;

      void getApplicationReviewDetail(update.applicationId)
        .then((detail) => {
          if (selectedIdRef.current !== update.applicationId) return;
          setSelectedDetail(detail);
          if (form.formState.isDirty) {
            markReviewConflict();
            return;
          }
          applyReviewForm(detail);
        })
        .catch((error) => {
          console.error("Unable to refresh application detail:", error);
        });

      void getApplicationReviewEvents(update.applicationId)
        .then((events) => {
          if (selectedIdRef.current !== update.applicationId) return;
          setReviewEvents(events);
        })
        .catch((error) => {
          console.error("Unable to refresh review history:", error);
        });
    });

    channel.subscribe((status, err) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Unable to subscribe to review sync channel:", err);
      }
    });

    return () => {
      active = false;
      reviewSyncChannel.current = null;
      if (channel) supabase.removeChannel(channel);
    };
  }, [
    applyReviewForm,
    form.formState.isDirty,
    markReviewConflict,
    organizer,
    realtimeReady,
    supabase,
    updateReviewItem,
  ]);

  const clearResumeExpiryTimer = useCallback(() => {
    if (resumeExpiryTimer.current) {
      clearTimeout(resumeExpiryTimer.current);
      resumeExpiryTimer.current = null;
    }
  }, []);

  const scheduleResumeExpiry = useCallback(() => {
    clearResumeExpiryTimer();
    resumeExpiryTimer.current = setTimeout(() => {
      setResumeExpired(true);
    }, RESUME_PREVIEW_URL_TTL_MS);
  }, [clearResumeExpiryTimer]);

  const fetchResumeDownloadUrl = useCallback(async (resumeKey: string) => {
    return getResumeDownloadUrl(resumeKey);
  }, []);

  const bindResumeUrl = useCallback(
    (url: string) => {
      setResumeUrl(url);
      setResumeExpired(false);
      scheduleResumeExpiry();
    },
    [scheduleResumeExpiry],
  );

  const loadResumePreview = useCallback(
    async (resumeKey: string) => {
      try {
        const url = await fetchResumeDownloadUrl(resumeKey);
        bindResumeUrl(url);
        return url;
      } catch (error) {
        console.error("Unable to load resume URL:", error);
        setResumeUrl(null);
        throw error;
      }
    },
    [bindResumeUrl, fetchResumeDownloadUrl],
  );

  useEffect(() => {
    const resumeKey = selectedDetail?.application.resume;
    if (!resumeKey) {
      clearResumeExpiryTimer();
      return;
    }

    let ignore = false;

    void fetchResumeDownloadUrl(resumeKey)
      .then((url) => {
        if (ignore) return;
        bindResumeUrl(url);
      })
      .catch((error) => {
        console.error("Unable to load resume URL:", error);
        if (!ignore) setResumeUrl(null);
      })
      .finally(() => {
        if (!ignore) setResumeLoadedKey(resumeKey);
      });

    return () => {
      ignore = true;
      clearResumeExpiryTimer();
    };
  }, [
    bindResumeUrl,
    clearResumeExpiryTimer,
    fetchResumeDownloadUrl,
    selectedDetail?.application.id,
    selectedDetail?.application.resume,
  ]);

  const resumeKey = selectedDetail?.application.resume;
  const resumeLoading = Boolean(resumeKey) && resumeLoadedKey !== resumeKey;
  const [prevResumeKey, setPrevResumeKey] = useState(resumeKey);

  if (resumeKey !== prevResumeKey) {
    setPrevResumeKey(resumeKey);
    if (resumeUrl !== null) setResumeUrl(null);
    if (resumeExpired) setResumeExpired(false);
    if (resumeLoadedKey !== null) setResumeLoadedKey(null);
  }

  const refreshResumePreview = useCallback(async () => {
    const resumeKey = selectedDetail?.application.resume;
    if (!resumeKey) return;

    setResumeRefreshing(true);
    try {
      await loadResumePreview(resumeKey);
    } catch {
      toast.error("Unable to refresh resume preview.");
    } finally {
      setResumeRefreshing(false);
    }
  }, [loadResumePreview, selectedDetail?.application.resume]);

  const openResumePreview = useCallback(async () => {
    const resumeKey = selectedDetail?.application.resume;
    if (!resumeKey) return;

    try {
      const url = await getResumeDownloadUrl(resumeKey, "attachment");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Unable to open resume:", error);
      toast.error("Unable to open resume.");
    }
  }, [selectedDetail?.application.resume]);

  useEffect(() => {
    if (!selectedId) return;

    let ignore = false;

    getApplicationReviewEvents(selectedId)
      .then((events) => {
        if (!ignore) setReviewEvents(events);
      })
      .catch((error) => {
        console.error("Unable to load review history:", error);
        if (!ignore) setReviewEvents([]);
      })
      .finally(() => {
        if (!ignore) setReviewEventsLoadedId(selectedId);
      });

    return () => {
      ignore = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!realtimeReady || !selectedId || !organizer) return;

    let active = true;
    let channel: ReviewSyncChannel | null = null;

    channel = supabase.channel(`application-review:${selectedId}`, {
      config: { private: true, presence: { key: organizer.id } },
    });
    if (!active) {
      supabase.removeChannel(channel);
      return;
    }

    const syncPresence = () => {
      if (!active || !channel) return;
      const state = channel.presenceState() as Record<string, PresenceMeta[]>;
      const reviewers = Object.values(state)
        .flat()
        .filter((meta) => meta.userId !== organizer.id);
      setActiveReviewers(reviewers);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status, err) => {
        if (status === "SUBSCRIBED") {
          await channel?.track({
            userId: organizer.id,
            email: organizer.email,
            onlineAt: new Date().toISOString(),
          });
          syncPresence();
        } else if (status === "CHANNEL_ERROR") {
          console.error("Unable to subscribe to review presence channel:", err);
        }
      });

    return () => {
      active = false;
      setActiveReviewers([]);
      if (channel) {
        void channel.untrack();
        supabase.removeChannel(channel);
      }
    };
  }, [organizer, realtimeReady, selectedId, supabase]);

  async function handleSubmitReview() {
    if (reviewConflict) {
      toast.error("Submit is blocked due to a conflict.");
      return;
    }

    const values = normalizeReviewValues(form.getValues());
    const parsed = reviewCompleteSchema.safeParse(values);
    const isPending = selectedDetail?.application.status === "pending";

    if (!parsed.success) {
      let toastMessage: string | null = null;
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "effortRating" ||
          field === "builderRating" ||
          field === "reviewComments"
        ) {
          form.setError(field, { message: issue.message });
          toastMessage ??= issue.message;
        }
      }
      toast.error(
        toastMessage ??
          "Fix the highlighted fields before submitting your review.",
      );
      return;
    }

    setIsCompleting(true);
    try {
      const result = await markApplicationReviewed({
        ...parsed.data,
        expectedUpdatedAt: serverUpdatedAt.current,
      });

      if (!result.ok) {
        markReviewConflict();
        toast.error("Submit is blocked due to a conflict.");
        return;
      }

      updateReviewItem(parsed.data.applicationId, result.review, result.status);
      appendReviewEvent(result.event);
      void broadcastReviewUpdate({
        applicationId: parsed.data.applicationId,
        review: result.review,
        status: result.status,
        event: result.event,
      });
      applyReviewForm({
        application: {
          ...selectedDetail!.application,
          status: result.status,
        },
        review: result.review,
      });
      setScorecardOpen(false);
      toast.success(isPending ? "Review submitted." : "Review updated.");
    } catch (error) {
      console.error("Unable to submit review:", error);
      toast.error(
        isPending
          ? "Unable to submit review. Please try again."
          : "Unable to update review. Please try again.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  const applicationsListBody = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <InboxIcon className="size-4 text-moss dark:text-sage" />
          <h2 className="text-sm font-semibold">Applications</h2>
        </div>
        <Badge variant="outline">{filteredItems.length}</Badge>
      </div>
      <div className="shrink-0 space-y-3 border-b p-3">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <TabsList className="grid h-auto w-full min-w-0 grid-cols-4 overflow-hidden p-1 group-data-horizontal/tabs:!h-auto [&>*]:min-w-0">
            <StatusFilterTab value="all" count={counts.total} />
            <StatusFilterTab value="pending" count={counts.pending} />
            <StatusFilterTab value="reviewed" count={counts.reviewed} />
            <StatusFilterTab value="flagged" count={counts.flagged} />
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No applications match this view.
          </div>
        ) : (
          <div className="divide-y">
            {paginatedItems.map((item) => {
              const active = item.application.id === selectedId;
              return (
                <button
                  key={item.application.id}
                  type="button"
                  onClick={() => void selectApplication(item)}
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
                      {new Date(item.application.createdAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={statusClassName(item.application.status)}
                    >
                      {applicationStatusLabel(item.application.status)}
                    </Badge>
                    {item.review?.flaggedForReview && (
                      <FlagIcon className="size-3.5 text-amber-600" />
                    )}
                    <ReviewBadge review={item.review} />
                  </div>
                  <p className="mt-2 truncate text-xs font-medium">
                    {item.application.university} · {item.application.major}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {item.application.whyMhacksPreview}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <ListPagination
        pageIndex={clampedApplicationsPage}
        totalItems={filteredItems.length}
        pageSize={APPLICATIONS_PAGE_SIZE}
        onPageChange={setApplicationsPage}
        className="shrink-0"
      />
    </>
  );

  const applicationDetailBody = (
    <>
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
            {selectedDetail
              ? `${applicantName(selectedDetail)} application`
              : "Select an application"}
          </span>
        </div>
        {selectedDetail && (
          <Badge
            variant="outline"
            className={statusClassName(selectedDetail.application.status)}
          >
            {applicationStatusLabel(selectedDetail.application.status)}
          </Badge>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {detailLoading && !selectedDetail ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            Loading application…
          </div>
        ) : !selectedDetail ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            Select an application to review.
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-7 p-4 pb-28 sm:p-5 md:p-6 lg:pb-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-3xl italic tracking-tight text-moss sm:text-4xl dark:text-sage">
                    {applicantName(selectedDetail)}
                  </h2>
                  <Badge
                    variant="outline"
                    className={statusClassName(
                      selectedDetail.application.status,
                    )}
                  >
                    {applicationStatusLabel(selectedDetail.application.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedDetail.application.applicantEmail ??
                    "No applicant email"}{" "}
                  · submitted{" "}
                  {new Date(
                    selectedDetail.application.createdAt,
                  ).toLocaleDateString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedDetail.application.resume && (
                    <QuickLink
                      onClick={() => void openResumePreview()}
                      label="Resume"
                      icon={<FileTextIcon className="size-3.5" />}
                    />
                  )}
                  <QuickLink
                    href={
                      selectedDetail.application.applicantEmail
                        ? `mailto:${selectedDetail.application.applicantEmail}`
                        : null
                    }
                    label="Email"
                  />
                  <QuickLink
                    href={externalHref(selectedDetail.application.github)}
                    label="GitHub"
                  />
                  <QuickLink
                    href={externalHref(selectedDetail.application.linkedin)}
                    label="LinkedIn"
                  />
                  <QuickLink
                    href={externalHref(selectedDetail.application.personalSite)}
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
              resumeKey={selectedDetail.application.resume}
              resumeUrl={resumeUrl}
              loading={resumeLoading}
              expired={resumeExpired}
              onRefresh={() => void refreshResumePreview()}
              onOpen={() => void openResumePreview()}
              refreshing={resumeRefreshing}
            />

            <Section title="Applicant Snapshot">
              <MetaItem label="Age" value={selectedDetail.application.age} />
              <MetaItem
                label="Gender"
                value={selectedDetail.application.gender}
              />
              <MetaItem
                label="Ethnicity"
                value={selectedDetail.application.ethnicity}
              />
              <MetaItem
                label="Phone"
                value={selectedDetail.application.phoneNumber}
              />
            </Section>

            <Section title="Academic Snapshot">
              <MetaItem
                label="University"
                value={selectedDetail.application.university}
              />
              <MetaItem
                label="Major"
                value={selectedDetail.application.major}
              />
              <MetaItem
                label="Degree"
                value={selectedDetail.application.degree}
              />
              <MetaItem
                label="Graduation year"
                value={selectedDetail.application.graduationYear}
              />
              <MetaItem
                label="Previous hackathons"
                value={selectedDetail.application.previousHackathons}
              />
              <MetaItem
                label="Country"
                value={selectedDetail.application.country}
              />
            </Section>

            <Section title="Essays">
              <EssayBlock
                label="Why MHacks?"
                value={selectedDetail.application.whyMhacks}
              />
              <EssayBlock
                label="Funding prompt"
                value={selectedDetail.application.whatWouldYouDo}
              />
              <EssayBlock
                label="Hill to die on"
                value={selectedDetail.application.hillToDieOn}
              />
              <EssayBlock
                label="Anything else"
                value={selectedDetail.application.anythingElse}
              />
            </Section>

            <Section title="Logistics">
              <MetaItem
                label="Transportation"
                value={selectedDetail.application.transportationType}
              />
              <MetaItem
                label="Coming from"
                value={selectedDetail.application.comingFrom}
              />
              <MetaItem
                label="Airport"
                value={selectedDetail.application.airportCode}
              />
              <MetaItem
                label="Shirt size"
                value={selectedDetail.application.shirtSize}
              />
              <MetaItem
                label="Allergies/restrictions"
                value={selectedDetail.application.allergiesDescription}
              />
              <MetaItem
                label="Needs reimbursement"
                value={selectedDetail.application.needsTravelReimbursement}
              />
              <MetaItem
                label="Would attend without reimbursement"
                value={
                  selectedDetail.application.wouldAttendWithoutReimbursement
                }
              />
            </Section>
          </div>
        )}
      </div>

      {selectedDetail && (
        <div className="shrink-0 border-t bg-card/95 px-3 pt-3 backdrop-blur supports-backdrop-filter:bg-card/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
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
    </>
  );

  const scorecardBody = (
    <ScrollArea className="min-h-0 flex-1">
      <ScorecardForm
        form={form}
        effortRating={effortRating}
        builderRating={builderRating}
        flaggedForReview={flaggedForReview}
        reviewConflict={reviewConflict}
        selectedDetail={selectedDetail}
        reviewEvents={reviewEvents}
        reviewEventsLoading={reviewEventsLoading}
        activeReviewers={activeReviewers}
        organizerEmail={organizer?.email}
        isCompleting={isCompleting}
        onSubmitReview={handleSubmitReview}
      />
    </ScrollArea>
  );

  if (isPhoneLandscape) {
    return (
      <main className="flex h-dvh items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full border bg-card text-moss dark:text-sage">
            <SmartphoneIcon className="size-6" />
          </div>
          <h1 className="font-heading text-3xl italic tracking-tight text-moss dark:text-sage">
            Rotate your phone
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            The review workspace works best in portrait on mobile.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="flex h-full flex-col">
        <ApplicationReviewHeader
          title="Application Review"
          variant="workspace"
          footer={
            <div className="mt-3 flex items-center gap-3">
              <Meter value={completionPercent} className="h-2 flex-1" />
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {completedCount} of {counts.total} complete
              </p>
            </div>
          }
        />

        {isDesktop ? (
          <ResizablePanelGroup
            id="application-review-workspace"
            orientation="horizontal"
            defaultLayout={panelLayout.defaultLayout}
            onLayoutChanged={panelLayout.onLayoutChanged}
            resizeTargetMinimumSize={{ coarse: 32, fine: 16 }}
            className="min-h-0 flex-1 overflow-hidden border-t bg-card"
          >
            <ResizablePanel
              id="applications-list"
              defaultSize={300}
              minSize={280}
              className="min-h-0 min-w-0"
            >
              <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r bg-card">
                {applicationsListBody}
              </aside>
            </ResizablePanel>

            <ResizablePanel
              id="application-detail"
              minSize={320}
              className="min-h-0 min-w-0"
            >
              <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r bg-muted/30">
                {applicationDetailBody}
              </section>
            </ResizablePanel>

            <ResizablePanel
              id="scorecard"
              defaultSize={330}
              minSize={300}
              className="min-h-0 min-w-0"
            >
              <aside className="flex h-full min-h-0 min-w-0 flex-col bg-card">
                {scorecardBody}
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t bg-card">
            <aside
              className={cn(
                "min-h-0 min-w-0 flex-col overflow-hidden border-r bg-card",
                mobileView === "list" ? "flex" : "hidden",
              )}
            >
              {applicationsListBody}
            </aside>

            <section
              className={cn(
                "min-h-0 min-w-0 flex-col overflow-hidden bg-muted/30",
                mobileView === "detail" ? "flex" : "hidden",
              )}
            >
              {applicationDetailBody}
            </section>
          </div>
        )}

        <AlertDialog
          open={pendingApplicationSwitch !== null}
          onOpenChange={(open) => {
            if (!open) setPendingApplicationSwitch(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <AlertTriangleIcon className="text-amber-600 dark:text-amber-400" />
              </AlertDialogMedia>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved review changes. Switch applications anyway?
                Your changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay here</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={confirmApplicationSwitch}
              >
                Switch anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!isDesktop && (
          <Drawer open={scorecardOpen} onOpenChange={setScorecardOpen}>
            <DrawerContent className="max-h-[92vh]">
              <DrawerHeader className="border-b text-left">
                <DrawerTitle className="font-heading text-2xl italic text-moss dark:text-sage">
                  Scorecard
                </DrawerTitle>
                <DrawerDescription>
                  {selectedDetail
                    ? `Reviewing ${applicantName(selectedDetail)}`
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
                    reviewConflict={reviewConflict}
                    selectedDetail={selectedDetail}
                    reviewEvents={reviewEvents}
                    reviewEventsLoading={reviewEventsLoading}
                    activeReviewers={activeReviewers}
                    organizerEmail={organizer?.email}
                    isCompleting={isCompleting}
                    onSubmitReview={handleSubmitReview}
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
  reviewConflict,
  selectedDetail,
  reviewEvents,
  reviewEventsLoading,
  activeReviewers,
  organizerEmail,
  isCompleting,
  onSubmitReview,
  compact = false,
}: {
  form: UseFormReturn<ReviewDraftInput>;
  effortRating: number | null;
  builderRating: number | null;
  flaggedForReview: boolean;
  reviewConflict: boolean;
  selectedDetail: ReviewListItem | undefined;
  reviewEvents: ReviewEventRecord[];
  reviewEventsLoading: boolean;
  activeReviewers: PresenceMeta[];
  organizerEmail?: string;
  isCompleting: boolean;
  onSubmitReview: () => void;
  compact?: boolean;
}) {
  const isPending = selectedDetail?.application.status === "pending";

  return (
    <form
      className={cn("min-w-0 space-y-5", compact ? "p-4" : "p-5")}
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
            Submit your review when scoring is complete.
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
                aria-invalid={!!form.formState.errors.reviewComments}
              />
            )}
          />
          {form.formState.errors.reviewComments && (
            <p className="text-xs text-destructive">
              {form.formState.errors.reviewComments.message}
            </p>
          )}
        </div>
      )}

      {(reviewConflict || selectedDetail?.review?.reviewedAt) && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          {reviewConflict && (
            <p className="text-destructive">
              Another organizer submitted a review while you were editing.
              Submit is blocked until you reload this application.
            </p>
          )}
          {selectedDetail?.review?.reviewedAt && (
            <div
              className={cn(
                "flex items-center gap-2 text-xs text-muted-foreground",
                reviewConflict && "mt-2",
              )}
            >
              <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-300" />
              Reviewed{" "}
              {new Date(selectedDetail.review.reviewedAt).toLocaleString()} by{" "}
              {selectedDetail.review.reviewerEmail ?? "organizer"}
            </div>
          )}
        </div>
      )}

      <ReviewEventTimeline
        events={reviewEvents}
        loading={reviewEventsLoading}
        compact
        maxHeight="12rem"
        className="w-full min-w-0"
      />

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
        onClick={onSubmitReview}
        disabled={!selectedDetail || isCompleting || reviewConflict}
        className="h-11 w-full bg-moss text-white hover:bg-moss/90 dark:bg-sage dark:text-night dark:hover:bg-sage/90"
      >
        {isCompleting
          ? isPending
            ? "Submitting review..."
            : "Updating review..."
          : isPending
            ? "Submit Review"
            : "Update Review"}
      </Button>

      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
        <UserRoundIcon className="size-4" />
        Signed in as {organizerEmail ?? "organizer"}
      </div>
    </form>
  );
}

const STATUS_FILTER_META: Record<
  StatusFilter,
  { label: string; shortLabel: string; icon: LucideIcon; colorClass: string }
> = {
  all: {
    label: "All",
    shortLabel: "All",
    icon: ListFilterIcon,
    colorClass: "text-moss dark:text-sage",
  },
  pending: {
    label: "Pending",
    shortLabel: "Pend",
    icon: InboxIcon,
    colorClass: "text-slate-600 dark:text-slate-400",
  },
  reviewed: {
    label: "Done",
    shortLabel: "Done",
    icon: CheckCircle2Icon,
    colorClass: "text-green-700 dark:text-green-300",
  },
  flagged: {
    label: "Flagged",
    shortLabel: "Flag",
    icon: FlagIcon,
    colorClass: "text-amber-700 dark:text-amber-300",
  },
};

function StatusFilterTab({
  value,
  count,
}: {
  value: StatusFilter;
  count: number;
}) {
  const {
    label,
    shortLabel,
    icon: Icon,
    colorClass,
  } = STATUS_FILTER_META[value];

  return (
    <TabsTrigger
      value={value}
      title={label}
      aria-label={`${label} (${count})`}
      className={cn(
        "box-border flex !h-auto w-full min-w-0 max-w-full flex-col items-center gap-0.5 overflow-hidden px-0.5 py-1.5 whitespace-normal after:hidden",
        "data-active:[&_[data-slot=filter-label]]:opacity-100",
        "data-active:[&_[data-slot=filter-count]]:opacity-100",
      )}
    >
      <span
        data-slot="filter-label"
        className="flex w-full min-w-0 items-center justify-center gap-1 opacity-70"
      >
        <Icon className={cn("size-3 shrink-0", colorClass)} aria-hidden />
        <span className={cn("truncate text-[10px] leading-none", colorClass)}>
          {shortLabel}
        </span>
      </span>
      <span
        data-slot="filter-count"
        className={cn(
          "block w-full min-w-0 truncate text-center text-xs leading-none italic tabular-nums opacity-80",
          colorClass,
        )}
      >
        {count}
      </span>
    </TabsTrigger>
  );
}
