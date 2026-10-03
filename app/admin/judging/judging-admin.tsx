"use client";

import { useState, useTransition, type FormEvent } from "react";
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
import {
  loadAdminJudgingSnapshot,
  resetJudgingDatabase,
  restoreDroppedProject,
  startAdminJudging,
  stopAdminJudging,
  uploadJudgingCsv,
} from "@/lib/actions/judging-admin.actions";
import { readProjectView, trackOptions } from "@/lib/judging/display";
import type {
  AdminJudgingSnapshot,
  CsvEnrichSummary,
} from "@/lib/judging/types";

export function JudgingAdmin({ initial }: { initial: AdminJudgingSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [summary, setSummary] = useState<CsvEnrichSummary | null>(null);
  const [track, setTrack] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(
    key: string,
    action: () => Promise<
      | { ok: true; snapshot: AdminJudgingSnapshot }
      | { ok: false; error: string }
    >,
    success: string,
  ) {
    setPending(key);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          setSnapshot(result.snapshot);
          toast.success(success);
        } else {
          toast.error(result.error);
        }
      } finally {
        setPending(null);
      }
    });
  }

  function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending("upload");
    startTransition(async () => {
      try {
        const result = await uploadJudgingCsv(formData);
        if (result.ok) {
          setSnapshot(result.snapshot);
          setSummary(result.summary);
          form.reset();
          toast.success("CSV uploaded. Judging is on.");
        } else {
          toast.error(result.error);
        }
      } finally {
        setPending(null);
      }
    });
  }

  const tracks = trackOptions(snapshot.rankings);
  const poolById = new Map(snapshot.pool.map((entry) => [entry.id, entry]));
  const ranked = snapshot.rankings.map((row, index) => ({
    rank: index + 1,
    view: readProjectView(row),
    removed: poolById.get(row.id)?.removed ?? false,
    strikes: poolById.get(row.id)?.strikes ?? 0,
  }));
  const visibleRanked = track
    ? ranked.filter((row) => row.view.track === track)
    : ranked;
  const flagged = snapshot.pool
    .filter((entry) => entry.removed || entry.strikes > 0)
    .map((entry) => ({ entry, view: readProjectView(entry) }))
    .sort(
      (left, right) =>
        Number(right.entry.removed) - Number(left.entry.removed) ||
        right.entry.strikes - left.entry.strikes ||
        left.view.title.localeCompare(right.view.title),
    );

  const busy = pending !== null;
  const status =
    snapshot.isStarted == null
      ? "Unknown"
      : snapshot.isStarted
        ? "Running"
        : "Stopped";

  return (
    <div className="flex flex-col gap-5">
      {snapshot.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {snapshot.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>
            Upload a Devpost export. Submission URLs are followed to the public
            project link and matched to teams in the dashboard. Judging has to
            be stopped before a different CSV replaces the dataset. Reset
            archives the SQLite file and starts empty.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={snapshot.isStarted ? "default" : "secondary"}>
              {status}
            </Badge>
            <Button
              type="button"
              size="sm"
              disabled={busy || snapshot.isStarted === true}
              onClick={() =>
                run("start", startAdminJudging, "Judging started.")
              }
            >
              Start judging
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || snapshot.isStarted === false}
              onClick={() => run("stop", stopAdminJudging, "Judging stopped.")}
            >
              Stop judging
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const confirmed = window.confirm(
                  "Archive the SQLite database and start empty? Rankings, open pairs, and strikes will be cleared.",
                );
                if (!confirmed) return;
                setPending("reset");
                startTransition(async () => {
                  try {
                    const result = await resetJudgingDatabase();
                    if (result.ok) {
                      setSnapshot(result.snapshot);
                      setSummary(null);
                      toast.success(
                        result.archivePath
                          ? `Database reset. Archive ${result.archivePath} saved.`
                          : "Database reset.",
                      );
                    } else {
                      toast.error(result.error);
                    }
                  } finally {
                    setPending(null);
                  }
                });
              }}
            >
              Reset SQLite
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPending("refresh");
                startTransition(async () => {
                  try {
                    setSnapshot(await loadAdminJudgingSnapshot());
                    toast.success("Refreshed.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not refresh.",
                    );
                  } finally {
                    setPending(null);
                  }
                });
              }}
            >
              Refresh
            </Button>
          </div>

          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={onUpload}
          >
            <input
              name="csv"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={busy}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5"
            />
            <Button type="submit" size="sm" disabled={busy}>
              Upload CSV
            </Button>
          </form>
          {snapshot.isStarted ? (
            <p className="text-sm text-muted-foreground">
              Judging is running. Stop it before uploading a different file.
              Uploading the same file while judging is on leaves rankings as
              they are.
            </p>
          ) : null}
          {summary ? <UploadSummary summary={summary} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
          <CardDescription>
            Strongest first. Rank stays the overall position when a track is
            selected.
            {snapshot.headers.length > 0
              ? ` Columns: ${snapshot.headers.join(", ")}.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            Track
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5"
              value={track}
              onChange={(event) => setTrack(event.target.value)}
            >
              <option value="">All tracks</option>
              {tracks.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {visibleRanked.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rankings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">Rank</th>
                    <th className="py-2 pr-3 font-medium">Project</th>
                    <th className="py-2 pr-3 font-medium">Track</th>
                    <th className="py-2 pr-3 font-medium">Table</th>
                    <th className="py-2 pr-3 font-medium">Team</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRanked.map((row) => (
                    <tr key={row.view.id} className="border-b border-border/70">
                      <td className="py-2 pr-3 tabular-nums">{row.rank}</td>
                      <td className="py-2 pr-3">{row.view.title}</td>
                      <td className="py-2 pr-3">{row.view.track || "—"}</td>
                      <td className="py-2 pr-3">
                        {row.view.tableLabel || "—"}
                      </td>
                      <td className="py-2 pr-3">{row.view.teamName || "—"}</td>
                      <td className="py-2">
                        {row.removed
                          ? "Dropped"
                          : row.strikes > 0
                            ? `${row.strikes} absence${row.strikes === 1 ? "" : "s"}`
                            : "Active"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dropped and absent</CardTitle>
          <CardDescription>
            Absences add a strike. A project that reaches the strike limit is
            dropped from new pairs and can be restored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody is dropped or marked absent.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {flagged.map(({ entry, view }) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{view.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {view.track || "No track"}
                      {view.tableLabel ? ` · Table ${view.tableLabel}` : ""}
                      {view.teamName ? ` · ${view.teamName}` : ""}
                      {" · "}
                      {entry.removed
                        ? `Dropped after ${entry.strikes} absences`
                        : `${entry.strikes} absence${entry.strikes === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {entry.removed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          `restore-${entry.id}`,
                          () => restoreDroppedProject(entry.id),
                          `${view.title} restored.`,
                        )
                      }
                    >
                      Restore
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Archives</CardTitle>
          <CardDescription>
            Each reset keeps the previous SQLite database here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.archives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archives yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {snapshot.archives.map((archive) => (
                <li key={archive}>
                  <a
                    className="underline underline-offset-2"
                    href={`/admin/judging/archives/${encodeURIComponent(archive)}`}
                  >
                    {archive}.zip
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UploadSummary({ summary }: { summary: CsvEnrichSummary }) {
  return (
    <p className="text-sm text-muted-foreground">
      {summary.projects} projects. {summary.matched} matched a dashboard Devpost
      link
      {summary.unmatched > 0 ? `, ${summary.unmatched} did not` : ""}.{" "}
      {summary.redirectFailures > 0
        ? `${summary.redirectFailures} submission URLs did not resolve to a public project link. `
        : ""}
      {summary.ambiguous > 0
        ? `${summary.ambiguous} links matched more than one team; the first team was kept. `
        : ""}
      {summary.renamedHeaders.length > 0
        ? `${summary.renamedHeaders.length} headers were renamed so the file could be stored. `
        : ""}
      Joined on {summary.submissionUrlHeader}.
      {summary.trackHeader
        ? ` Track column: ${summary.trackHeader}.`
        : " No track column was detected."}
      {summary.unmatchedSamples.length > 0
        ? ` Unmatched: ${summary.unmatchedSamples.join(", ")}.`
        : ""}
    </p>
  );
}
