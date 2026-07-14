import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BarChart3Icon,
  CrownIcon,
  HistoryIcon,
  MedalIcon,
  TrophyIcon,
  UsersRoundIcon,
} from "lucide-react";
import { getApplicationReviewLeaderboard } from "@/lib/queries/application-review";
import type { ReviewLeaderboardRow } from "@/lib/types/application-reviews";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ReviewEventRow } from "../review-event-timeline";
import ThemeToggle from "../theme-toggle";

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SummaryBar({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    hint: string;
    icon: ReactNode;
  }>;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card md:flex md:divide-x md:divide-border/60">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 gap-3 px-4 py-4">
          <div className="shrink-0 text-moss dark:text-sage">{item.icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="font-heading text-2xl italic text-moss dark:text-sage">
              {item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {item.hint}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-moss/10 dark:bg-sage/10",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-moss transition-all dark:bg-sage"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function rankIcon(index: number) {
  if (index === 0) {
    return <CrownIcon className="size-4 text-amber-500 dark:text-amber-300" />;
  }
  if (index === 1) {
    return <MedalIcon className="size-4 text-slate-400 dark:text-slate-300" />;
  }
  if (index === 2) {
    return (
      <MedalIcon className="size-4 text-orange-600 dark:text-orange-400" />
    );
  }
  return null;
}

function rankLabel(index: number) {
  if (index === 0) return "1st";
  if (index === 1) return "2nd";
  if (index === 2) return "3rd";
  return `${index + 1}`;
}

function LeaderboardRow({
  row,
  index,
  maxCompleted,
}: {
  row: ReviewLeaderboardRow;
  index: number;
  maxCompleted: number;
}) {
  const progress =
    maxCompleted === 0
      ? 0
      : Math.round((row.completedApplications / maxCompleted) * 100);

  return (
    <div
      className={cn(
        "px-4 py-3",
        index === 0 && "bg-amber-50/60 dark:bg-amber-950/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex w-6 shrink-0 items-center justify-center">
            {rankIcon(index) ?? (
              <span className="text-xs text-muted-foreground">
                {rankLabel(index)}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.reviewerEmail}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Last completed {formatDate(row.lastActivityAt)}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-xl italic text-moss dark:text-sage">
            {row.completedApplications}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.reviewedApplications} reviewed · {row.flaggedApplications}{" "}
            flagged
          </p>
        </div>
      </div>
      <Meter value={progress} className="mt-2.5 h-1.5" />
    </div>
  );
}

export default async function ApplicationReviewLeaderboardPage() {
  const data = await getApplicationReviewLeaderboard();
  const activeRows = data.rows.filter((row) => row.completedApplications > 0);
  const topReviewer = activeRows[0];
  const maxCompleted = topReviewer?.completedApplications ?? 0;

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-red-hat text-xs font-semibold uppercase tracking-[0.22em] text-moss/55 dark:text-sage/60">
              MHacks Organizer
            </p>
            <h1 className="font-heading text-4xl italic tracking-tight text-moss dark:text-sage">
              Review Leaderboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Completed application scorecards by organizer, with recent review
              activity below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/applications">
                <ArrowLeftIcon className="size-4" />
                Back to reviews
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/applications/analytics">
                <BarChart3Icon className="size-4" />
                Analytics
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <SummaryBar
          items={[
            {
              label: "Completed",
              value: data.totals.completedApplications,
              hint: "Applications with a submitted review scorecard.",
              icon: <TrophyIcon className="size-5" />,
            },
            {
              label: "Active reviewers",
              value: data.totals.activeReviewers,
              hint: "Organizers with at least one completed review.",
              icon: <UsersRoundIcon className="size-5" />,
            },
            {
              label: "Audit events",
              value: data.totals.totalEvents,
              hint: `${data.totals.draftEvents} drafts · ${data.totals.completionEvents} completions.`,
              icon: <HistoryIcon className="size-5" />,
            },
            {
              label: "Top reviewer",
              value: topReviewer?.completedApplications ?? 0,
              hint: topReviewer?.reviewerEmail ?? "No completed reviews yet.",
              icon: <CrownIcon className="size-5" />,
            },
          ]}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrophyIcon className="size-5 text-moss dark:text-sage" />
              <CardTitle>Organizer Rankings</CardTitle>
            </div>
            <CardDescription>
              Each completion counts once from the canonical review row, so
              draft saves do not inflate totals.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {activeRows.length === 0 ? (
              <div className="px-4 pb-4">
                <div className="flex h-44 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
                  No completed reviews yet. Rankings will appear here once
                  organizers finish scorecards.
                </div>
              </div>
            ) : (
              <ScrollArea className="max-h-[560px]">
                <div className="divide-y divide-border/60">
                  {activeRows.map((row, index) => (
                    <LeaderboardRow
                      key={row.reviewerUserId}
                      row={row}
                      index={index}
                      maxCompleted={maxCompleted}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HistoryIcon className="size-5 text-moss dark:text-sage" />
              <CardTitle>Recent Activity</CardTitle>
            </div>
            <CardDescription>
              Latest review edits across organizers — draft saves and completed
              scorecards. Showing up to 100 most recent events.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {data.recentEvents.length === 0 ? (
              <div className="px-4 pb-4">
                <div className="flex h-36 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
                  No review activity yet. Edits will show up here as organizers
                  save drafts or complete scorecards.
                </div>
              </div>
            ) : (
              <ScrollArea className="max-h-[480px]">
                <div className="divide-y divide-border/60">
                  {data.recentEvents.map((event) => (
                    <ReviewEventRow key={event.id} event={event} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
