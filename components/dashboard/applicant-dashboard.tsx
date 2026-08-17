import Link from "next/link";

import { ButtonLink } from "@/components/console/button";
import { Panel, PanelHeading } from "@/components/console/panel";
import { ProgressMeter, StatusLine } from "@/components/console/progress";
import { Rail, RailNote } from "@/components/console/rail";
import {
  ConsoleFooterRule,
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { ToolCard, ToolGrid } from "@/components/console/tool-card";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { ADMIN_AREAS } from "@/lib/admin/sections";
import type { UserRole } from "@/lib/db/schema/users";
import { EVENT } from "@/lib/config/event";

/**
 * Where an applicant stands. `stage` chooses the panel and nothing else does,
 * so the whole page stays a server component: there is no client JavaScript in
 * the path between signing in and seeing where you are.
 *
 * The stage is derived in app/dashboard/page.tsx from the decision and the
 * saved draft, never stored — the two can't drift.
 */
export type ApplicantStage = "applying" | "in-review" | "decision-ready";

export type ApplicantDashboardData = {
  stage: ApplicantStage;
  /** Sections finished in a saved draft. 0 once submitted. */
  sectionsComplete: number;
  sectionsTotal: number;
  /** Pre-formatted, e.g. "12 August 2026". Absent before submitting. */
  submittedAt?: string;
};

export function ApplicantDashboard({
  data,
  role,
  firstName,
}: {
  data: ApplicantDashboardData;
  role: UserRole;
  firstName: string | null;
}) {
  return (
    <div className="font-red-hat">
      <ConsoleShell>
        <ConsolePage>
          <Masthead
            title={firstName ? `Hey, ${firstName}` : "Your dashboard"}
            trailing={<SignOutButton />}
          />

          {data.stage === "applying" ? <ApplyingPanel data={data} /> : null}
          {data.stage === "in-review" ? <InReviewPanel data={data} /> : null}
          {data.stage === "decision-ready" ? <DecisionReadyPanel /> : null}

          {role === "organizer" ? <OrganizerTools /> : null}

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}

/** The quiet way back to a submitted application. */
function ViewApplicationLink() {
  return (
    <Link
      href="/apply"
      className="font-red-hat-mono text-[11.5px] tracking-[0.02em] text-ui-ink-soft underline underline-offset-2 transition-colors hover:text-ui-ink"
    >
      View your submitted application
    </Link>
  );
}

/* ——— 1 · mid-application ——————————————————————————————————————— */

/**
 * Two readings of the same stage. Nothing started is its own message, and it
 * gets no meter: a 0-of-6 row of empty cells reads as a stall rather than as an
 * invitation.
 */
function ApplyingPanel({ data }: { data: ApplicantDashboardData }) {
  const started = data.sectionsComplete > 0;

  return (
    <Panel eyebrow="YOUR APPLICATION">
      <PanelHeading
        lede={
          started
            ? "Your progress is saved. Finish the remaining sections whenever you're ready."
            : `Applications for ${EVENT.fullName} are open. It takes about fifteen minutes, and you can save your progress as you go.`
        }
      >
        {started ? "Pick up where you left off" : "You haven't applied yet"}
      </PanelHeading>

      {started ? (
        <ProgressMeter
          complete={data.sectionsComplete}
          total={data.sectionsTotal}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3.5">
        <ButtonLink href="/apply" external={false}>
          {started ? "Continue your application" : "Start your application"}
        </ButtonLink>
      </div>
    </Panel>
  );
}

/* ——— 2 · submitted, in review —————————————————————————————————— */

/**
 * No button, on purpose. There is nothing for them to do, and a dashboard that
 * offers an action here would only invite someone to re-submit or re-check.
 * "Reviewed" is left off the status line too: an applicant cannot tell when it
 * happens, and a step that never visibly ticks reads as a stall.
 */
function InReviewPanel({ data }: { data: ApplicantDashboardData }) {
  return (
    <Panel eyebrow="YOUR APPLICATION" status="In review">
      <PanelHeading lede="Every application is read by our team. Nothing else is needed from you — we'll email you the moment decisions are released, and your result will appear here too.">
        Your application is in
      </PanelHeading>

      <StatusLine
        steps={[
          { label: "Submitted", done: true },
          { label: "Decision released", done: false },
        ]}
        note={data.submittedAt ? `Submitted ${data.submittedAt}` : undefined}
      />

      <ViewApplicationLink />
    </Panel>
  );
}

/* ——— 3 · decision released ————————————————————————————————————— */

/**
 * The button is a plain link to the decision route, so opening a letter is a
 * server-rendered navigation like any other — it arrives fully formed rather
 * than being revealed by client state.
 */
function DecisionReadyPanel() {
  return (
    <Panel eyebrow="YOUR APPLICATION" status="Decision ready">
      <PanelHeading lede="Reviews are complete and your result is waiting. Open it whenever you have a minute — a copy is in your email either way.">
        Your decision is ready
      </PanelHeading>

      <StatusLine
        steps={[
          { label: "Submitted", done: true },
          { label: "Reviewed", done: true },
          { label: "Decision released", done: true },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3.5">
        <ButtonLink href="/dashboard/decision" external={false}>
          See decision
        </ButtonLink>
      </div>

      <ViewApplicationLink />
    </Panel>
  );
}

/* ——— organizer ————————————————————————————————————————————————— */

/**
 * Composed below the applicant panels rather than replacing them: an organizer
 * may well have applied too, and hiding their own application behind their
 * role would be a worse dashboard.
 *
 * The role check happens at the route. "Not visible to hackers" on the rail is
 * for the organizer's benefit, not a security boundary.
 */
function OrganizerTools() {
  const tools = ADMIN_AREAS.flatMap((area) =>
    area.links.map((link) => ({ ...link, category: area.title })),
  );

  return (
    <div className="flex flex-col gap-3.5">
      <Rail
        label="ORGANIZER TOOLS"
        ramp={false}
        trailing={<RailNote>Not visible to hackers</RailNote>}
      />

      <ToolGrid>
        {tools.map((tool) => (
          <ToolCard
            key={tool.href}
            eyebrow={tool.category.toUpperCase()}
            name={tool.title}
            description={tool.description}
            href={tool.href}
          />
        ))}
      </ToolGrid>
    </div>
  );
}
