"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsoleFooterRule,
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import {
  chooseJudgingWinner,
  listJudgingProjects,
  loadJudgingPair,
  reportJudgingAbsence,
} from "@/lib/actions/judging.actions";
import {
  readProjectView,
  splitLinks,
  trackOptions,
  type ProjectView,
} from "@/lib/judging/display";
import type { JudgingPair, JudgingRow } from "@/lib/judging/types";
import type { TableWithTeam } from "@/lib/reservation/types";
import { ProjectFloorMap, type FloorHighlight } from "./project-floor-map";

const ACTION_BUTTON =
  "shrink-0 cursor-pointer rounded-[2px] border px-3.5 py-2 font-red-hat-mono text-[12px] tracking-[0.02em] whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink disabled:cursor-not-allowed disabled:opacity-50";
const ACTION_PRIMARY = `${ACTION_BUTTON} border-ui-ink bg-ui-ink text-ui-surface hover:opacity-90`;
const ACTION_OUTLINE = `${ACTION_BUTTON} border-ui-line-strong bg-transparent text-ui-ink hover:bg-ui-selected`;
const SELECT_CLASS =
  "rounded-[2px] border border-ui-line-strong bg-ui-paper px-3 py-2 font-red-hat-mono text-[13px] text-ui-ink focus:outline-2 focus:outline-offset-2 focus:outline-ui-ink";

function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="font-red-hat-mono text-[11.5px] tracking-[0.02em] text-ui-ink-soft underline underline-offset-2 transition-colors hover:text-ui-ink"
    >
      {children}
    </Link>
  );
}

function FieldValue({ value }: { value: string }) {
  const links = splitLinks(value);
  if (links.length === 0) {
    return <span className="break-words whitespace-pre-wrap">{value}</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      {links.map((href) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="break-all underline underline-offset-2"
        >
          {href}
        </a>
      ))}
    </span>
  );
}

function ProjectCard({
  side,
  project,
  pending,
  onWin,
  onAbsent,
}: {
  side: "A" | "B";
  project: ProjectView;
  pending: boolean;
  onWin: () => void;
  onAbsent: () => void;
}) {
  return (
    <article className="flex min-w-0 flex-col gap-3 border border-ui-line bg-ui-well px-3 py-3">
      <p className="font-red-hat-mono text-[10.5px] tracking-[0.14em] text-ui-ink-soft uppercase">
        Project {side}
      </p>
      <h3 className="font-red-hat-mono text-lg leading-tight font-bold text-ui-ink">
        {project.title}
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-ui-ink-soft">Track</dt>
        <dd>{project.track || "—"}</dd>
        <dt className="text-ui-ink-soft">Table</dt>
        <dd>{project.tableLabel || "—"}</dd>
        <dt className="text-ui-ink-soft">Team</dt>
        <dd>{project.teamName || "—"}</dd>
      </dl>
      {project.url ? (
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className="break-all font-red-hat-mono text-[12px] text-ui-ink underline underline-offset-2"
        >
          {project.url}
        </a>
      ) : null}
      {project.highlights.length > 0 ? (
        <dl className="flex flex-col gap-2 text-[13px] leading-[1.5]">
          {project.highlights.map((field) => (
            <div key={field.label}>
              <dt className="font-red-hat-mono text-[10.5px] tracking-[0.08em] text-ui-ink-soft uppercase">
                {field.label}
              </dt>
              <dd className="mt-1 text-ui-ink">
                <FieldValue value={field.value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {project.details.length > 0 ? (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-red-hat-mono text-[11px] tracking-[0.08em] text-ui-ink-soft uppercase">
            All fields
          </summary>
          <dl className="mt-2 flex max-h-64 flex-col gap-2 overflow-auto">
            {project.details.map((field) => (
              <div key={field.label}>
                <dt className="text-ui-ink-soft">{field.label}</dt>
                <dd className="text-ui-ink">
                  <FieldValue value={field.value} />
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className={ACTION_PRIMARY}
          disabled={pending}
          onClick={onWin}
        >
          {side} wins
        </button>
        <button
          type="button"
          className={ACTION_OUTLINE}
          disabled={pending}
          onClick={onAbsent}
        >
          {side} is absent
        </button>
      </div>
    </article>
  );
}

export function JudgeConsole({
  canManage,
  map,
  initialProjects,
  projectsError: initialProjectsError,
}: {
  canManage: boolean;
  map: { columns: number; rows: number; tables: TableWithTeam[] };
  initialProjects: JudgingRow[];
  projectsError: string | null;
}) {
  const [tab, setTab] = useState<"compare" | "projects">("compare");
  const [pair, setPair] = useState<JudgingPair | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);
  const [loadingPair, setLoadingPair] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [projects, setProjects] = useState(initialProjects);
  const [projectsError, setProjectsError] = useState(initialProjectsError);
  const [track, setTrack] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void loadJudgingPair().then((result) => {
      if (cancelled) return;
      setLoadingPair(false);
      if (result.ok) setPair(result.pair);
      else setPairError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyPair(
    result: { ok: true; pair: JudgingPair } | { ok: false; error: string },
  ) {
    if (result.ok) {
      setPair(result.pair);
      setPairError(null);
      return;
    }
    setPairError(result.error);
    toast.error(result.error);
  }

  function run(
    key: string,
    action: () => Promise<
      { ok: true; pair: JudgingPair } | { ok: false; error: string }
    >,
  ) {
    setPendingKey(key);
    startTransition(async () => {
      try {
        applyPair(await action());
      } finally {
        setPendingKey(null);
      }
    });
  }

  const left = pair ? readProjectView(pair.pair[0]) : null;
  const right = pair ? readProjectView(pair.pair[1]) : null;
  const tracks = trackOptions(projects);
  const projectViews = projects.map(readProjectView);
  const visibleProjects = track
    ? projectViews.filter((project) => project.track === track)
    : projectViews;

  let highlight: FloorHighlight = { mode: "floor" };
  if (tab === "compare" && left && right) {
    highlight = {
      mode: "pair",
      left: left.tableNumeric,
      right: right.tableNumeric,
    };
  } else if (tab === "projects" && track) {
    highlight = {
      mode: "track",
      tableNumbers: visibleProjects.flatMap((project) =>
        project.tableNumeric == null ? [] : [project.tableNumeric],
      ),
    };
  }

  const pending = pendingKey !== null || loadingPair;

  return (
    <div className="font-red-hat">
      <ConsoleShell fieldSrc="/mhacks_blue_auth_bg.png">
        <ConsolePage>
          <Masthead title="Judging" trailing={<SignOutButton />} />
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <BackLink href="/dashboard">Back to dashboard</BackLink>
            {canManage ? (
              <BackLink href="/admin/judging">Judging controls</BackLink>
            ) : null}
          </div>

          <div
            role="tablist"
            aria-label="Judging"
            className="flex gap-1 border-b border-ui-line"
          >
            {(
              [
                ["compare", "Compare"],
                ["projects", "Projects"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`border-b-2 px-3 py-2 font-red-hat-mono text-[12px] tracking-[0.08em] uppercase ${
                  tab === id
                    ? "border-ui-ink text-ui-ink"
                    : "border-transparent text-ui-ink-soft hover:text-ui-ink"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "compare" ? (
            <Panel
              eyebrow="THIS PAIR"
              status={loadingPair ? "Drawing" : pair ? "Ready" : "Waiting"}
            >
              <PanelHeading lede="Pick a winner, or mark who is not at the table. One absence gives the win to the project that is here. Both absences strike each project and draw a new pair.">
                Two projects
              </PanelHeading>
              {pairError ? (
                <p className="text-sm text-ui-ink">{pairError}</p>
              ) : null}
              {loadingPair ? (
                <p className="font-red-hat-mono text-[12px] text-ui-ink-soft">
                  Drawing a pair…
                </p>
              ) : null}
              {left && right ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ProjectCard
                      side="A"
                      project={left}
                      pending={pending}
                      onWin={() =>
                        run("win-a", () =>
                          chooseJudgingWinner([left.id, right.id], left.id),
                        )
                      }
                      onAbsent={() =>
                        run("absent-a", () => reportJudgingAbsence([left.id]))
                      }
                    />
                    <ProjectCard
                      side="B"
                      project={right}
                      pending={pending}
                      onWin={() =>
                        run("win-b", () =>
                          chooseJudgingWinner([left.id, right.id], right.id),
                        )
                      }
                      onAbsent={() =>
                        run("absent-b", () => reportJudgingAbsence([right.id]))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className={ACTION_OUTLINE}
                    disabled={pending}
                    onClick={() =>
                      run("absent-both", () =>
                        reportJudgingAbsence([left.id, right.id]),
                      )
                    }
                  >
                    Both are absent
                  </button>
                </>
              ) : !loadingPair ? (
                <button
                  type="button"
                  className={ACTION_PRIMARY}
                  disabled={pending}
                  onClick={() => run("reload", () => loadJudgingPair())}
                >
                  Load a pair
                </button>
              ) : null}
            </Panel>
          ) : (
            <Panel eyebrow="ALL PROJECTS" status={track || "All tracks"}>
              <PanelHeading lede="Every project in the current dataset. Choose a track to list only those projects and mark their tables on the map.">
                Projects
              </PanelHeading>
              {projectsError ? (
                <p className="text-sm text-ui-ink">{projectsError}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="project-track"
                  className="font-red-hat-mono text-[11px] tracking-[0.08em] text-ui-ink-soft uppercase"
                >
                  Track
                </label>
                <select
                  id="project-track"
                  className={SELECT_CLASS}
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
                <button
                  type="button"
                  className={ACTION_OUTLINE}
                  onClick={() => {
                    setPendingKey("projects");
                    startTransition(async () => {
                      try {
                        const result = await listJudgingProjects();
                        if (result.ok) {
                          setProjects(result.projects);
                          setProjectsError(null);
                        } else {
                          setProjectsError(result.error);
                          toast.error(result.error);
                        }
                      } finally {
                        setPendingKey(null);
                      }
                    });
                  }}
                >
                  Refresh
                </button>
              </div>
            </Panel>
          )}

          <Panel
            eyebrow="FLOOR"
            status={tab === "projects" && track ? track : "Map"}
          >
            <PanelHeading lede="The same floor plan hackers use when they reserve a table. A project is placed only when its Devpost link matches a team submission.">
              Where they are
            </PanelHeading>
            <ProjectFloorMap
              tables={map.tables}
              columns={map.columns}
              rows={map.rows}
              highlight={highlight}
            />
            {tab === "compare" &&
            left &&
            right &&
            left.tableNumeric == null &&
            right.tableNumeric == null ? (
              <p className="text-sm text-ui-ink-soft">
                Neither project is matched to a reserved table.
              </p>
            ) : null}
            {tab === "projects" &&
            track &&
            visibleProjects.every((project) => project.tableNumeric == null) ? (
              <p className="text-sm text-ui-ink-soft">
                None of the projects in this track are matched to a reserved
                table.
              </p>
            ) : null}
          </Panel>

          {tab === "projects" ? (
            <Panel eyebrow="LIST" status={`${visibleProjects.length} shown`}>
              {visibleProjects.length === 0 ? (
                <p className="text-sm text-ui-ink-soft">
                  No projects to show yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {visibleProjects.map((project) => (
                    <li
                      key={project.id}
                      className="grid gap-1 border border-ui-line bg-ui-well px-3 py-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <p className="font-red-hat-mono text-[13px] font-medium text-ui-ink">
                          {project.title}
                        </p>
                        <p className="text-[13px] text-ui-ink-soft">
                          {[
                            project.track || "No track",
                            project.tableLabel
                              ? `Table ${project.tableLabel}`
                              : "No table",
                            project.teamName,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-red-hat-mono text-[12px] text-ui-ink underline underline-offset-2"
                        >
                          Devpost
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
