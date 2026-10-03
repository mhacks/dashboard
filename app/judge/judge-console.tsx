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
  submitJudgeVote,
  type JudgePair,
  type JudgeProject,
} from "@/lib/actions/judging.server.actions";
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
  const [pair, setPair] = useState<JudgePair | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [absentIntent, setAbsentIntent] = useState<JudgeProject[] | null>(null);
  const [isPending, startTransition] = useTransition();
  // The last absence report, so a rate-limited one is retried as sent.
  const lastAbsent = useRef<number[]>([]);

  const fetchPair = useCallback(async (absent: number[]) => {
    lastAbsent.current = absent;
    try {
      const result = await getJudgePair(absent);
      if (result.ok && result.data) {
        setPair(result.data);
        setWinnerId(null);
        setFailure(null);
        lastAbsent.current = [];
        return;
      }
      if (!result.ok) {
        setFailure({ ...result, source: "load" });
        if (result.code && BLOCKING_CODES.has(result.code)) setPair(null);
      }
    } catch {
      setFailure({ error: NETWORK_FAILURE, source: "load" });
    }
  }, []);

  const load = useCallback(
    (absent: number[] = []) => {
      startTransition(() => fetchPair(absent));
    },
    [fetchPair],
  );

  useEffect(() => {
    load();
  }, [load]);

  // MDredd's rate limit is shared by every judge, so a busy moment is normal.
  // Loads retry on their own once it allows; votes wait for the judge.
  useEffect(() => {
    if (failure?.source !== "load" || failure.code !== "RATE_LIMITED") return;
    const timer = setTimeout(
      () => load(lastAbsent.current),
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
            await fetchPair([]);
            return;
          }
          setFailure({ ...result, source: "vote" });
          return;
        }
        toast.success("Vote recorded.");
        await fetchPair([]);
      } catch {
        setFailure({ error: NETWORK_FAILURE, source: "vote" });
      }
    });
  }

  function reportAbsent(projects: JudgeProject[]) {
    setAbsentIntent(null);
    load(projects.map((project) => project.id));
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
                onClick={() => load(lastAbsent.current)}
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

        {failure ? (
          <p
            role="alert"
            className="border border-ui-line-strong bg-ui-well px-3.5 py-2.5 text-sm text-ui-ink"
          >
            {failure.error}
          </p>
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
