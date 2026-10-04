"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  DownloadIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  restoreJudgingProject,
  setJudgingOpen,
  setJudgingPairMinutes,
  syncJudgingTables,
} from "@/lib/actions/judging.server.actions";
import { MAX_PAIR_SECONDS, MIN_PAIR_SECONDS } from "@/lib/judging/timer";
import type { JudgingUploadResult } from "@/lib/judging/errors";
import type { MdreddUnresolvedRow } from "@/lib/judging/mdredd";
import type { TableSyncResult } from "@/lib/judging/teams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type JudgingProjectRow = {
  id: number;
  /** 1 is strongest. Null before judging has ever started. */
  rank: number | null;
  name: string;
  url: string;
  teamName: string | null;
  tableNumber: number | null;
  strikes: number;
  removed: boolean;
  /** Main track, then every sponsor prize the project opted into. */
  tracks: string[];
};

export type UnmatchedTeam = {
  teamId: string;
  teamName: string;
  devpostUrl: string;
};

export type JudgingPageState =
  | { kind: "error"; error: string }
  | {
      kind: "ready";
      started: boolean;
      projects: JudgingProjectRow[];
      /** Teams whose saved Devpost link matches no uploaded project. */
      unmatchedTeams: UnmatchedTeam[];
      /** How long judges get per pair. */
      pairMinutes: number;
    };

export function JudgingManagement({ state }: { state: JudgingPageState }) {
  if (state.kind === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Judging is unavailable</CardTitle>
          <CardDescription role="alert">{state.error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <ReadyJudging {...state} />;
}

function ReadyJudging({
  started,
  projects,
  unmatchedTeams,
  pairMinutes,
}: Extract<JudgingPageState, { kind: "ready" }>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const removedCount = projects.filter((p) => p.removed).length;
  const seatedCount = projects.filter((p) => p.tableNumber !== null).length;
  const sorted = [...projects].sort(
    (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.id - b.id,
  );

  function toggleJudging() {
    startTransition(async () => {
      try {
        const result = await setJudgingOpen(!started);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        toast.error("Could not reach the server. Try again.");
      }
    });
  }

  function restore(project: JudgingProjectRow) {
    startTransition(async () => {
      try {
        const result = await restoreJudgingProject(project.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        toast.error("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Judging</CardTitle>
                <CardDescription>
                  Judges get pairs at /judge while judging is running.
                </CardDescription>
              </div>
              <Badge variant={started ? "default" : "outline"}>
                {started ? "Running" : "Stopped"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{projects.length} projects</Badge>
            <Badge variant="secondary">{seatedCount} with a table</Badge>
            {removedCount > 0 ? (
              <Badge variant="destructive">{removedCount} removed</Badge>
            ) : null}
            <PairTimeControl minutes={pairMinutes} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={started ? "outline" : "default"}
              disabled={isPending || projects.length === 0}
              onClick={toggleJudging}
            >
              {started ? (
                <PauseIcon data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
              {started ? "Stop judging" : "Start judging"}
            </Button>
            <ExportMenu projects={projects} />
          </CardFooter>
        </Card>

        <UploadCard started={started} />
      </div>

      <TablesCard
        projects={projects}
        unmatchedTeams={unmatchedTeams}
        seatedCount={seatedCount}
      />

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            Strongest first. A project marked absent too many times in a row is
            removed from the draw until you restore it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No projects yet. Upload the Devpost export to start.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="w-20">Table</TableHead>
                  <TableHead className="w-20">Strikes</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>{project.rank ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          {project.name}
                        </a>
                      ) : (
                        project.name
                      )}
                    </TableCell>
                    <TableCell
                      className={
                        project.teamName ? undefined : "text-muted-foreground"
                      }
                    >
                      {project.teamName ?? "No matching team"}
                    </TableCell>
                    <TableCell
                      className={
                        project.tableNumber !== null
                          ? undefined
                          : "text-muted-foreground"
                      }
                    >
                      {project.tableNumber ?? "—"}
                    </TableCell>
                    <TableCell>{project.strikes}</TableCell>
                    <TableCell className="text-right">
                      {project.removed ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => restore(project)}
                        >
                          <RotateCcwIcon data-icon="inline-start" />
                          Restore
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Every project, or one track's projects strongest first. */
function ExportMenu({ projects }: { projects: JudgingProjectRow[] }) {
  const trackCounts = new Map<string, number>();
  for (const project of projects) {
    for (const track of project.tracks) {
      trackCounts.set(track, (trackCounts.get(track) ?? 0) + 1);
    }
  }
  const tracks = [...trackCounts].sort(([a], [b]) => a.localeCompare(b));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <DownloadIcon data-icon="inline-start" />
          Export CSV
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto max-w-80">
        <DropdownMenuItem asChild>
          <a href="/admin/teams/judging/export" download>
            All projects
          </a>
        </DropdownMenuItem>
        {tracks.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>By track</DropdownMenuLabel>
            {tracks.map(([track, count]) => (
              <DropdownMenuItem key={track} asChild>
                <a
                  href={`/admin/teams/judging/export?track=${encodeURIComponent(track)}`}
                  download
                  className="justify-between gap-4"
                >
                  <span className="truncate">{track}</span>
                  <span className="text-muted-foreground">{count}</span>
                </a>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Minutes a judge gets per pair. A pair already handed out keeps its start
 * time, so a change also shortens or lengthens pairs in progress.
 */
function PairTimeControl({ minutes }: { minutes: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(minutes));
  const [isPending, startTransition] = useTransition();
  const parsed = Number(value);
  const changed = Number.isInteger(parsed) && parsed !== minutes;

  function save() {
    startTransition(async () => {
      try {
        const result = await setJudgingPairMinutes(parsed);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        toast.error("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <form
      className="flex basis-full flex-wrap items-center gap-2 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed) save();
      }}
    >
      <label htmlFor="pair-minutes" className="text-sm font-medium">
        Minutes per pair
      </label>
      <Input
        id="pair-minutes"
        type="number"
        inputMode="numeric"
        min={MIN_PAIR_SECONDS / 60}
        max={MAX_PAIR_SECONDS / 60}
        step={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={isPending}
        className="w-20"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={isPending || !changed}
      >
        {isPending ? "Saving…" : "Save"}
      </Button>
      <p className="basis-full text-xs text-muted-foreground">
        When time runs out, the judge moves to a new pair with no vote recorded.
        Changes apply to pairs already in progress, counted from when each was
        handed out.
      </p>
    </form>
  );
}

function UploadCard({ started }: { started: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState<MdreddUnresolvedRow[]>([]);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUnresolved([]);
    try {
      const body = new FormData();
      body.append("csv", file);
      const response = await fetch("/admin/teams/judging/upload", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as JudgingUploadResult;
      if (!result.ok) {
        setError(result.error);
        setUnresolved(result.unresolved ?? []);
        return;
      }
      toast.success(result.message);
      setFile(null);
      if (input.current) input.current.value = "";
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload projects</CardTitle>
        <CardDescription>
          The Devpost projects export (CSV). Drafts are skipped. Every
          submission link is followed to its public project page, which can take
          a minute. Uploading starts judging and sends table numbers.
          {started ? " Stop judging first to replace the project list." : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          aria-label="Devpost projects CSV"
          disabled={uploading}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {unresolved.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Problem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unresolved.map((row) => (
                <TableRow key={row.submission_url}>
                  <TableCell>
                    <a
                      href={row.submission_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {row.title || row.submission_url}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {UNRESOLVED_REASONS[row.code] ?? row.code}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          disabled={!file || uploading}
          onClick={() => void upload()}
        >
          {uploading ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <UploadIcon data-icon="inline-start" />
          )}
          {uploading ? "Resolving Devpost links…" : "Upload"}
        </Button>
      </CardFooter>
    </Card>
  );
}

const UNRESOLVED_REASONS: Record<string, string> = {
  INVALID_DEVPOST_URL: "Not a Devpost link",
  DEVPOST_LOGIN_REQUIRED:
    "Devpost asked for a login. Publish the gallery or set MDREDD_DEVPOST_COOKIE.",
  DEVPOST_NOT_FOUND: "Devpost has no page at this link",
  DEVPOST_REDIRECTED_OFFSITE: "Redirected away from Devpost",
  DEVPOST_TOO_MANY_REDIRECTS: "Too many redirects",
  DEVPOST_UNAVAILABLE: "Devpost did not respond",
};

function TablesCard({
  projects,
  unmatchedTeams,
  seatedCount,
}: {
  projects: JudgingProjectRow[];
  unmatchedTeams: UnmatchedTeam[];
  seatedCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastSync, setLastSync] = useState<TableSyncResult | null>(null);
  const unseated = projects.filter((p) => p.tableNumber === null);

  function sync() {
    startTransition(async () => {
      try {
        const result = await syncJudgingTables();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        setLastSync(result.data ?? null);
        router.refresh();
      } catch {
        toast.error("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tables</CardTitle>
        <CardDescription>
          Projects are matched to teams by the Devpost link each team saved.
          Only projects with a table are sent to judges. Tables are re-sent to
          the judging server whenever a judge asks for a pair after a change;
          Sync sends them right away.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Projects without a table ({unseated.length} of {projects.length})
          </p>
          {unseated.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {projects.length === 0
                ? "No projects uploaded."
                : `All ${seatedCount} projects have a table.`}
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
              {unseated.map((project) => (
                <li key={project.id}>
                  {project.name}{" "}
                  <span className="text-muted-foreground">
                    {project.teamName
                      ? `— ${project.teamName} has no table`
                      : "— no team saved this link"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Team links that match no project ({unmatchedTeams.length})
          </p>
          {unmatchedTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every team&apos;s link matches an uploaded project.
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
              {unmatchedTeams.map((team) => (
                <li key={team.teamId} className="break-all">
                  {team.teamName}{" "}
                  <span className="text-muted-foreground">
                    — {team.devpostUrl}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending || projects.length === 0}
          onClick={sync}
        >
          {isPending ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          Sync tables
        </Button>
        {lastSync ? (
          <p className="text-sm text-muted-foreground">
            Sent {lastSync.stored} table numbers.
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
