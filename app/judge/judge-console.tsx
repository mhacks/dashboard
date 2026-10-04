"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { buttonClass, Caret } from "@/components/console/button";
import { Panel, PanelHeading } from "@/components/console/panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { JudgingMap } from "@/app/dashboard/team/judging-map";
import {
  getJudgePair,
  skipJudgePair,
  submitJudgeVote,
  type JudgeAssignment,
  type JudgePair,
  type JudgeProject,
} from "@/lib/actions/judging.server.actions";
import {
  TIMER_URGENT_SECONDS,
  TIMER_WARNING_SECONDS,
} from "@/lib/judging/timer";
import type { TableWithTeam } from "@/lib/reservation/types";
import { cn } from "@/lib/utils";

type Failure = {
  error: string;
  code?: string;
  retryAfterMs?: number;
  /** A failed load is retried for the judge; a failed vote waits for them. */
  source: "load" | "vote";
};

// Without a pair there is nothing to show but the reason.
const BLOCKING_CODES = new Set([
  "JUDGING_NOT_STARTED",
  "JUDGING_NEVER_STARTED",
  "POOL_EXHAUSTED",
  "NOT_CONFIGURED",
]);

/** What the last pair request asked for, so a failed one is retried as sent. */
type PairRequest = { absent?: number[]; skip?: [number, number] };

type ActivePair = {
  pair: JudgePair;
  /** Date.now() when time runs out, from the server's time remaining. */
  deadline: number;
  durationMs: number;
};

const pairKey = (pair: JudgePair) => `${pair[0].id}:${pair[1].id}`;

const NETWORK_FAILURE =
  "Could not reach the dashboard. Check your connection and try again.";

export function JudgeConsole({
  tables,
  columns,
  rows,
}: {
  tables: TableWithTeam[];
  columns: number;
  rows: number;
}) {
  const [active, setActive] = useState<ActivePair | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [absentIntent, setAbsentIntent] = useState<JudgeProject[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const lastRequest = useRef<PairRequest>({});
  // The pair whose timeout is being handled, so it is skipped only once.
  const expiring = useRef<string | null>(null);
  const pair = active?.pair ?? null;

  const fetchPair = useCallback(async (request: PairRequest) => {
    lastRequest.current = request;
    try {
      const result = request.skip
        ? await skipJudgePair(request.skip)
        : await getJudgePair(request.absent ?? []);
      if (result.ok && result.data) {
        const data: JudgeAssignment = result.data;
        setActive({
          pair: data.pair,
          deadline: Date.now() + data.remainingMs,
          durationMs: data.durationMs,
        });
        setNow(Date.now());
        setWinnerId(null);
        setFailure(null);
        lastRequest.current = {};
        return;
      }
      if (!result.ok) {
        setFailure({ ...result, source: "load" });
        if (result.code && BLOCKING_CODES.has(result.code)) setActive(null);
      }
    } catch {
      setFailure({ error: NETWORK_FAILURE, source: "load" });
    }
  }, []);

  const load = useCallback(
    (request: PairRequest = {}) => {
      startTransition(() => fetchPair(request));
    },
    [fetchPair],
  );

  // Tick while a pair is open.
  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [active]);

  const remainingMs = active ? Math.max(0, active.deadline - now) : 0;
  const expired = active !== null && remainingMs === 0;

  // Out of time: give the pair up unjudged and move on. A vote already on
  // its way is left to finish; the next pair loads after it either way.
  useEffect(() => {
    if (!expired || !active || isPending) return;
    const key = pairKey(active.pair);
    if (expiring.current === key) return;
    expiring.current = key;
    setAbsentIntent(null);
    toast.info("Time's up. Here's your next pair.");
    load({ skip: [active.pair[0].id, active.pair[1].id] });
  }, [expired, active, isPending, load]);

  useEffect(() => {
    load();
  }, [load]);

  // MDredd's rate limit is shared by every judge, so a busy moment is normal.
  // Loads retry on their own once it allows; votes wait for the judge.
  useEffect(() => {
    if (failure?.source !== "load" || failure.code !== "RATE_LIMITED") return;
    const timer = setTimeout(
      () => load(lastRequest.current),
      Math.max(1_000, failure.retryAfterMs ?? 5_000),
    );
    return () => clearTimeout(timer);
  }, [failure, load]);

  function vote() {
    if (!pair || winnerId === null) return;
    const entityIds: [number, number] = [pair[0].id, pair[1].id];
    startTransition(async () => {
      try {
        const result = await submitJudgeVote({ entityIds, winnerId });
        if (!result.ok) {
          if (result.code === "JUDGE_DOES_NOT_OWN_PAIR") {
            toast.error(result.error);
            await fetchPair({});
            return;
          }
          setFailure({ ...result, source: "vote" });
          return;
        }
        toast.success("Vote recorded.");
        await fetchPair({});
      } catch {
        setFailure({ error: NETWORK_FAILURE, source: "vote" });
      }
    });
  }

  function reportAbsent(projects: JudgeProject[]) {
    setAbsentIntent(null);
    load({ absent: projects.map((project) => project.id) });
  }

  if (!pair) {
    return (
      <Panel
        eyebrow="JUDGING"
        status={failure ? undefined : isPending ? "Loading" : undefined}
      >
        {failure ? (
          <>
            <PanelHeading lede={failure.error}>
              {failure.code === "POOL_EXHAUSTED"
                ? "Nothing left to judge"
                : failure.code === "RATE_LIMITED"
                  ? "One moment"
                  : "No pair right now"}
            </PanelHeading>
            <div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => load(lastRequest.current)}
                className={buttonClass("outline", "disabled:opacity-50")}
              >
                {isPending ? "Checking…" : "Check again"}
              </button>
            </div>
          </>
        ) : (
          <PanelHeading lede="Finding two projects for you to compare.">
            Loading your pair…
          </PanelHeading>
        )}
      </Panel>
    );
  }

  const highlighted = pair
    .map((project) => project.tableId)
    .filter((id): id is string => id !== null);

  return (
    <>
      <Panel eyebrow="YOUR PAIR" status={isPending ? "Working…" : undefined}>
        <PanelHeading lede="Visit both tables, then pick the stronger project. If a team isn't at its table, mark it absent and you'll get a new pair.">
          Which project is better?
        </PanelHeading>

        {active ? (
          <PairTimer remainingMs={remainingMs} durationMs={active.durationMs} />
        ) : null}

        {failure ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border border-ui-line-strong bg-ui-well px-3.5 py-2.5 text-sm text-ui-ink"
          >
            <span>{failure.error}</span>
            {failure.source === "load" && failure.code !== "RATE_LIMITED" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => load(lastRequest.current)}
                className="font-red-hat-mono text-[12px] underline underline-offset-2 disabled:opacity-50"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3.5 sm:grid-cols-2">
          {pair.map((project, index) => (
            <ProjectCard
              key={project.id}
              label={index === 0 ? "PROJECT A" : "PROJECT B"}
              project={project}
              selected={winnerId === project.id}
              disabled={isPending}
              onSelect={() => setWinnerId(project.id)}
              onAbsent={() => setAbsentIntent([project])}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            disabled={isPending || winnerId === null}
            onClick={vote}
            className={buttonClass("primary", "disabled:opacity-50")}
          >
            <Caret />
            {winnerId === null
              ? "Pick a project to vote"
              : `Vote for ${pair.find((project) => project.id === winnerId)?.name ?? "this project"}`}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setAbsentIntent([...pair])}
            className={buttonClass("outline", "disabled:opacity-50")}
          >
            Neither team is here
          </button>
        </div>
      </Panel>

      <Panel eyebrow="FLOOR MAP">
        <JudgingMap
          tables={tables}
          columns={columns}
          rows={rows}
          selectedTableId={null}
          teamId={null}
          mode="judge"
          highlightedTableIds={highlighted}
        />
      </Panel>

      <AlertDialog
        open={absentIntent !== null}
        onOpenChange={(open) => {
          if (!open) setAbsentIntent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {absentIntent && absentIntent.length > 1
                ? "Mark both teams absent?"
                : `Mark ${absentIntent?.[0]?.name ?? "this project"} absent?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {absentIntent && absentIntent.length > 1
                ? "Neither project gets a vote, and you'll get a new pair."
                : "The other project wins this pair, and you'll get a new pair."}{" "}
              A project marked absent several times in a row leaves judging
              until an organizer restores it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => absentIntent && reportAbsent(absentIntent)}
            >
              Mark absent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatClock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * The pair's countdown. Amber under a minute, red and pulsing in the last
 * seconds. Screen readers hear the stage changes, not every tick.
 */
function PairTimer({
  remainingMs,
  durationMs,
}: {
  remainingMs: number;
  durationMs: number;
}) {
  const seconds = remainingMs / 1000;
  const stage =
    seconds <= TIMER_URGENT_SECONDS
      ? "urgent"
      : seconds <= TIMER_WARNING_SECONDS
        ? "warning"
        : "normal";
  const fraction = durationMs > 0 ? Math.min(1, remainingMs / durationMs) : 0;
  const announcement =
    stage === "urgent"
      ? "A few seconds left on this pair."
      : stage === "warning"
        ? "Less than a minute left on this pair."
        : "";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border px-3.5 py-3 transition-colors",
        stage === "normal" && "border-ui-line bg-ui-well",
        stage === "warning" &&
          "border-amber-500 bg-amber-50 dark:bg-amber-950/40",
        stage === "urgent" &&
          "animate-pulse border-red-600 bg-red-50 motion-reduce:animate-none dark:bg-red-950/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft">
          {stage === "normal" ? "TIME LEFT" : "TIME ALMOST UP"}
        </span>
        <span
          role="timer"
          aria-label={`${formatClock(remainingMs)} left on this pair`}
          className={cn(
            "font-red-hat-mono text-2xl font-bold tabular-nums",
            stage === "normal" && "text-ui-ink",
            stage === "warning" && "text-amber-700 dark:text-amber-400",
            stage === "urgent" && "text-red-700 dark:text-red-400",
          )}
        >
          {formatClock(remainingMs)}
        </span>
      </div>
      <div aria-hidden className="h-2 w-full overflow-hidden bg-ui-line">
        <div
          className={cn(
            "h-full transition-[width] duration-300 ease-linear",
            stage === "normal" && "bg-ui-ink",
            stage === "warning" && "bg-amber-500",
            stage === "urgent" && "bg-red-600",
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      {stage !== "normal" ? (
        <p className="text-sm text-ui-ink">
          {stage === "urgent"
            ? "Vote now, or you'll move to a new pair."
            : "Less than a minute left. Vote before time runs out."}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function ProjectCard({
  label,
  project,
  selected,
  disabled,
  onSelect,
  onAbsent,
}: {
  label: string;
  project: JudgeProject;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onAbsent: () => void;
}) {
  const devpostUrl = project.url.startsWith("https://") ? project.url : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border p-4 transition-colors",
        selected ? "border-ui-ink bg-ui-selected" : "border-ui-line",
      )}
    >
      <p className="font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft">
        {label}
      </p>

      <div>
        <h3 className="font-red-hat-mono text-lg leading-tight font-bold text-ui-ink">
          {project.name || "Untitled project"}
        </h3>
        <p className="mt-1 text-sm text-ui-ink-soft">
          {project.teamName ?? "Team not found in the dashboard"}
        </p>
      </div>

      <p className="font-red-hat-mono text-2xl font-bold text-ui-ink">
        {project.tableNumber !== null
          ? `Table ${project.tableNumber}`
          : "No table on record"}
      </p>

      {project.tracks.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {project.tracks.map((track) => (
            <li
              key={track}
              className="border border-ui-line bg-ui-well px-2 py-0.5 font-red-hat-mono text-[11px] text-ui-ink-soft"
            >
              {track}
            </li>
          ))}
        </ul>
      ) : null}

      {devpostUrl ? (
        <a
          href={devpostUrl}
          target="_blank"
          rel="noreferrer"
          className="font-red-hat-mono text-[12px] text-ui-ink-soft underline underline-offset-2 hover:text-ui-ink"
        >
          Open on Devpost
        </a>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-1">
        <button
          type="button"
          aria-pressed={selected}
          disabled={disabled}
          onClick={onSelect}
          className={buttonClass(
            selected ? "secondary" : "outline",
            "disabled:opacity-50",
          )}
        >
          {selected ? "Picked" : "Pick this project"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onAbsent}
          className="self-start font-red-hat-mono text-[12px] text-ui-ink-soft underline underline-offset-2 hover:text-ui-ink disabled:opacity-50"
        >
          Not at their table
        </button>
      </div>
    </div>
  );
}
