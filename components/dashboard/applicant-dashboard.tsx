import Link from "next/link";
import Image from "next/image";

import { QrCode } from "@/components/checkin/qr-code";
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
import { CalendarSyncCard } from "@/components/dashboard/calendar-sync-card";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { QrDrawerButton } from "@/app/dashboard/qr-button";
import { ADMIN_AREAS } from "@/lib/admin/sections";
import { canJudge, isEventStaff } from "@/lib/auth/guards";
import type { UserRole } from "@/lib/db/schema/users";
import { MAX_TEAM_SIZE } from "@/lib/types/teams";

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
  /** Whether an unsubmitted application can still be edited or submitted. */
  applicationsOpen: boolean;
  /** Pre-formatted, e.g. "12 August 2026". Absent before submitting. */
  submittedAt?: string;
};

export function ApplicantDashboard({
  data,
  role,
  firstName,
  userId,
  canCheckIn,
  checkedIn,
  showLiveSite,
  strandedTeamName,
  appleWalletAvailable,
  googleWalletAvailable,
}: {
  data: ApplicantDashboardData;
  role: UserRole;
  firstName: string | null;
  /** Encoded into the check-in QR. Only read when `canCheckIn` is true. */
  userId: string;
  /** Accepted and RSVPed — the people who can actually be scanned in. */
  canCheckIn: boolean;
  /**
   * Application decision is `checked_in`. The manage-team panel stays hidden
   * otherwise.
   */
  checkedIn: boolean;
  /** RSVPed or checked in. The live site link stays hidden otherwise. */
  showLiveSite: boolean;
  /**
   * Set when a hacker is still on a team after check-in was reverted. They
   * can open the team page to leave, and cannot manage it until they check in.
   */
  strandedTeamName: string | null;
  /**
   * Whether this environment can sign Apple Wallet passes.
   */
  appleWalletAvailable: boolean;
  /**
   * Whether this environment can create and sign Google Wallet passes.
   */
  googleWalletAvailable: boolean;
}) {
  return (
    <div className="font-red-hat">
      <ConsoleShell>
        <ConsolePage>
          <Masthead
            title={firstName ? `Hey, ${firstName}` : "Your dashboard"}
            trailing={
              <div className="flex items-center gap-2">
                <ConnectionsLink />
                <SignOutButton />
              </div>
            }
          />

          {role === "hacker" && showLiveSite ? <HandbookPanel /> : null}

          {/* Above the application panels, because it outranks them: anyone
              who can see this has already been accepted and RSVPed, so their
              decision is settled news and the code is the thing they came to
              the dashboard to find. */}
          {canCheckIn ? (
            <CheckInPanel
              userId={userId}
              appleWalletAvailable={appleWalletAvailable}
              googleWalletAvailable={googleWalletAvailable}
            />
          ) : null}

          {checkedIn && role === "hacker" ? <TeamPanel /> : null}
          {checkedIn && role === "hacker" ? <FindOrganizerPanel /> : null}
          {strandedTeamName ? (
            <StrandedTeamPanel teamName={strandedTeamName} />
          ) : null}

          {data.stage === "applying" ? <ApplyingPanel data={data} /> : null}
          {data.stage === "in-review" ? <InReviewPanel data={data} /> : null}
          {data.stage === "decision-ready" ? <DecisionReadyPanel /> : null}

          {isEventStaff(role) ? <StaffTools role={role} /> : null}
          {canJudge(role) ? <JudgeTools /> : null}
          {role === "organizer" ? <OrganizerTools /> : null}

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}

/**
 * Connected apps and the linked Discord account. Sits beside sign-out as the
 * same mono chip, since both are about the account rather than the application.
 */
function ConnectionsLink() {
  return (
    <Link
      href="/account/connections"
      className="rounded-[2px] border border-ui-line-strong bg-ui-paper px-2.5 py-[5px] font-red-hat-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-ui-ink uppercase transition-colors duration-200 hover:bg-ui-selected focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink"
    >
      Connections
    </Link>
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

  if (!data.applicationsOpen) {
    return (
      <Panel eyebrow="YOUR APPLICATION" status="Closed">
        <PanelHeading
          lede={
            started
              ? "The application deadline has passed. Your saved draft is still available to view, but it can no longer be changed or submitted."
              : "The application deadline for MHacks 2026 has passed."
          }
        >
          Applications are closed
        </PanelHeading>

        {started ? (
          <div className="flex flex-wrap items-center gap-3.5">
            <ButtonLink href="/apply" external={false}>
              View your saved draft
            </ButtonLink>
          </div>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel eyebrow="YOUR APPLICATION">
      <PanelHeading
        lede={
          started
            ? "Your progress is saved. Finish the remaining sections whenever you're ready."
            : "Applications for MHacks 2026 are open. It takes about fifteen minutes, and you can save your progress as you go."
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

/* ——— team ————————————————————————————————————————————————————— */

/**
 * Sits under the check-in panel once this hacker is checked in. The page
 * itself stays at /dashboard/team; this only points there.
 */
function StrandedTeamPanel({ teamName }: { teamName: string }) {
  return (
    <Panel eyebrow="YOUR TEAM">
      <PanelHeading
        lede={`You're still on ${teamName}. Check in again to manage the team, or leave it.`}
      >
        Check-in required
      </PanelHeading>
      <div className="flex flex-wrap items-center gap-3.5">
        <ButtonLink href="/dashboard/team" external={false}>
          Leave this team
        </ButtonLink>
      </div>
    </Panel>
  );
}

function TeamPanel() {
  return (
    <Panel eyebrow="TEAM AND SUBMISSION">
      <PanelHeading
        lede={`Create a team or accept an invite. Teams can have up to ${MAX_TEAM_SIZE} hackers.`}
      >
        Team and submission
      </PanelHeading>

      <div className="flex flex-wrap items-center gap-3.5">
        <ButtonLink href="/dashboard/team" external={false}>
          Manage team and submission
        </ButtonLink>
      </div>
    </Panel>
  );
}

/* ——— check-in ————————————————————————————————————————————————— */

/**
 * A panel of its own rather than a line inside the decision panel: by the time
 * this matters the decision is old news, and the code is the thing being looked
 * for in a queue.
 *
 * The QR is rendered here, on the server, and passed into the drawer as
 * children, so the encoded code travels with the page rather than being
 * fetched when the sheet opens.
 *
 * /dashboard/qr renders the same code full screen and needs no JavaScript at
 * all. It is no longer linked from here, but it stays reachable by URL — it is
 * the fallback to send someone to if this sheet won't open on their phone.
 *
 * The same code is also offered as Apple and Google Wallet passes. Both use
 * plain <a> elements rather than next/link: Apple returns a .pkpass download,
 * while Google provisions the object and redirects to Google's Save flow.
 */
function CheckInPanel({
  userId,
  appleWalletAvailable,
  googleWalletAvailable,
}: {
  userId: string;
  appleWalletAvailable: boolean;
  googleWalletAvailable: boolean;
}) {
  const walletLabel =
    appleWalletAvailable && googleWalletAvailable
      ? "Apple Wallet or Google Wallet"
      : appleWalletAvailable
        ? "Apple Wallet"
        : "Google Wallet";

  return (
    <Panel eyebrow="CHECK-IN" status="Ready">
      <PanelHeading
        lede={
          appleWalletAvailable || googleWalletAvailable
            ? `This is your check-in code for the weekend. Organizers will scan this for attendance and meals. Add it to ${walletLabel} to pull it up quickly, even offline.`
            : "This is your check-in code for the weekend. Organizers will scan this for attendance and meals."
        }
      >
        Your check-in code
      </PanelHeading>

      <div className="flex flex-wrap items-center gap-3.5">
        <QrDrawerButton>
          <QrCode
            value={userId}
            label="Your MHacks check-in code"
            className="w-[min(78vw,340px)]"
          />
        </QrDrawerButton>

        {appleWalletAvailable ? (
          <a
            href="/wallet/pass"
            aria-label="Add to Apple Wallet"
            className="inline-flex p-2 max-sm:w-full max-sm:justify-center"
          >
            <Image
              src="/wallet/apple/add-to-apple-wallet.svg"
              alt="Add to Apple Wallet"
              width={174}
              height={55}
            />
          </a>
        ) : null}

        {googleWalletAvailable ? (
          <a
            href="/wallet/google"
            aria-label="Add to Google Wallet"
            className="inline-flex p-2 max-sm:w-full max-sm:justify-center"
          >
            <Image
              src="/wallet/google/add-to-google-wallet.svg"
              alt="Add to Google Wallet"
              width={199}
              height={55}
            />
          </a>
        ) : null}
      </div>
    </Panel>
  );
}

/**
 * Hackers who have RSVPed or checked in. Same paper box as the panels below
 * it, so it isn't a bare line under the greeting. The button sits beside the
 * copy on wide screens.
 */
function HandbookPanel() {
  return (
    <Panel eyebrow="GUIDE">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <PanelHeading lede="Schedule, venue, and what is happening this weekend.">
          Live site
        </PanelHeading>
        <div className="w-full shrink-0 sm:w-auto">
          <ButtonLink href="/live" external={false}>
            Open the live site
          </ButtonLink>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Checked-in hackers only — the page refuses anyone else, so the link would
 * be a dead end before check-in.
 */
function FindOrganizerPanel() {
  return (
    <Panel eyebrow="HELP">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <PanelHeading lede="See where organizers are on a map and walk over.">
          Find an organizer
        </PanelHeading>
        <div className="w-full shrink-0 sm:w-auto">
          <ButtonLink href="/find-my-organizer" external={false}>
            Open the map
          </ButtonLink>
        </div>
      </div>
    </Panel>
  );
}

/* ——— event staff ——————————————————————————————————————————————— */

/**
 * The scanner, surfaced for volunteers as well as organizers.
 *
 * It needs its own block because ADMIN_AREAS only renders for organizers, and a
 * volunteer would otherwise have no way to find the one tool they have — the
 * link exists, but nothing on any screen would point at it.
 */
function StaffTools({ role }: { role: UserRole }) {
  return (
    <div className="flex flex-col gap-3.5">
      <Rail
        label="EVENT STAFF"
        ramp={false}
        trailing={<RailNote>Organizers and volunteers</RailNote>}
      />

      <ToolGrid>
        <ToolCard
          eyebrow="CHECK-IN"
          name="Scanner"
          description="Scan attendee codes at the door and at meals."
          href="/checkin"
        />
        {role === "volunteer" ? (
          <ToolCard
            eyebrow="HELP"
            name="Find my organizer"
            description="See where organizers are on a map."
            href="/find-my-organizer"
          />
        ) : null}
      </ToolGrid>
    </div>
  );
}

/**
 * The judging page, for judges and for organizers who fill in. A judge has no
 * other tool on this dashboard, so without this they would have no way in.
 */
function JudgeTools() {
  return (
    <div className="flex flex-col gap-3.5">
      <Rail
        label="JUDGING"
        ramp={false}
        trailing={<RailNote>Judges and organizers</RailNote>}
      />

      <ToolGrid>
        <ToolCard
          eyebrow="JUDGING"
          name="Judge projects"
          description="Get two projects at a time, visit their tables, and pick the stronger one."
          href="/judge"
        />
      </ToolGrid>
    </div>
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
        <CalendarSyncCard />
      </ToolGrid>
    </div>
  );
}
