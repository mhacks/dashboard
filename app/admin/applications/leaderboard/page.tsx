import {
  CrownIcon,
  HistoryIcon,
  MedalIcon,
  TrophyIcon,
  UsersRoundIcon,
} from "lucide-react";
import { getApplicationReviewLeaderboard } from "@/lib/queries/application-review";
import type { ReviewLeaderboardRow } from "@/lib/types/application-reviews";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Meter } from "../components/meter";
import { SummaryBar } from "../components/summary-bar";
import { AuditActivityFeed } from "./audit-activity-feed";

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
    <AdminPageShell>
      <AdminPageHeader
        title="Review Leaderboard"
        description="Completed application scorecards by organizer, with recent review activity below."
      />

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
            Each completion counts once from the canonical review row, so draft
            saves do not inflate totals.
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
          <AuditActivityFeed events={data.recentEvents} />
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
