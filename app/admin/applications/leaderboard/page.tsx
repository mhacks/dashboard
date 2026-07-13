import Link from "next/link";
import {
  ArrowLeftIcon,
  BarChart3Icon,
  HistoryIcon,
  MedalIcon,
  TrophyIcon,
} from "lucide-react";
import { getApplicationReviewLeaderboard } from "@/lib/actions/application-review.server.actions";
import type { ReviewAuditEventRecord } from "@/lib/types/application-reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ThemeToggle from "../theme-toggle";

const REVIEW_EVENT_FIELD_LABELS: Record<string, string> = {
  effortRating: "Effort",
  builderRating: "Builder",
  flaggedForReview: "Flag",
  reviewComments: "Comments",
  reviewedAt: "Reviewed time",
};

function formatEventValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" && value.length > 64) {
    return `${value.slice(0, 64)}...`;
  }
  return String(value);
}

function describeChanges(event: ReviewAuditEventRecord) {
  const entries = Object.entries(event.changes);
  if (entries.length === 0) return "No field changes";

  return entries
    .map(([field, change]) => {
      const label = REVIEW_EVENT_FIELD_LABELS[field] ?? field;
      return `${label}: ${formatEventValue(change.from)} -> ${formatEventValue(change.to)}`;
    })
    .join("; ");
}

function eventLabel(event: ReviewAuditEventRecord["eventType"]) {
  if (event === "review_completed") return "Completed";
  return "Draft saved";
}

function statusBadgeClass(status: ReviewAuditEventRecord["applicationStatus"]) {
  if (status === "reviewed") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/50 dark:text-green-300";
  }
  if (status === "flagged") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="font-red-hat text-xs font-semibold uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-3xl italic text-moss dark:text-sage">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default async function ApplicationReviewLeaderboardPage() {
  const data = await getApplicationReviewLeaderboard();
  const topReviewer = data.rows[0];

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
              Tracks current completed applications by reviewer and keeps the
              edit history available for later audit.
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

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Completed"
            value={data.totals.completedApplications}
            hint="Current review rows with reviewed time."
          />
          <StatCard
            label="Active reviewers"
            value={data.totals.activeReviewers}
            hint="Organizers with completed reviews."
          />
          <StatCard
            label="Audit events"
            value={data.totals.totalEvents}
            hint={`${data.totals.draftEvents} drafts, ${data.totals.completionEvents} completions.`}
          />
          <StatCard
            label="Top reviewer"
            value={topReviewer?.completedApplications ?? 0}
            hint={topReviewer?.reviewerEmail ?? "No completed reviews yet."}
          />
        </section>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrophyIcon className="size-5 text-moss dark:text-sage" />
              <CardTitle>Organizer Tracker</CardTitle>
            </div>
            <CardDescription>
              Completed apps are counted from the latest canonical review row,
              so repeated draft saves do not inflate the leaderboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Reviewed</TableHead>
                  <TableHead className="text-right">Flagged</TableHead>
                  <TableHead>Last completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, index) => (
                  <TableRow key={row.reviewerUserId}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1">
                        {index === 0 && row.completedApplications > 0 ? (
                          <MedalIcon className="size-4 text-amber-600 dark:text-amber-300" />
                        ) : null}
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.reviewerEmail}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.completedApplications}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.reviewedApplications}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.flaggedApplications}
                    </TableCell>
                    <TableCell>{formatDate(row.lastActivityAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HistoryIcon className="size-5 text-moss dark:text-sage" />
              <CardTitle>Recent Audit Log</CardTitle>
            </div>
            <CardDescription>
              Latest 100 meaningful review edits, including draft saves and
              completed-review updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEvents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No audit events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDate(event.createdAt)}</TableCell>
                      <TableCell>
                        {event.reviewerEmail ?? "organizer"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {event.applicationName}
                        </div>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(event.applicationStatus)}
                        >
                          {event.applicationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{eventLabel(event.eventType)}</TableCell>
                      <TableCell className="max-w-[520px] whitespace-normal text-muted-foreground">
                        {describeChanges(event)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
