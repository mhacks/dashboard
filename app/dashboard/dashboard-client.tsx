"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { FileTextIcon } from "lucide-react";

import {
  DashboardTile,
  TileBody,
  TileChip,
  TileTitle,
} from "@/components/dashboard/dashboard-tile";
import { DecisionLetterModal } from "@/components/decision/decision-letter-modal";
import { Footer } from "@/components/landing/sections/Footer";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Meter } from "@/components/ui/meter";
import { logout } from "@/lib/actions/auth.server.actions";
import { ADMIN_AREAS } from "@/lib/admin/sections";
import { APPLICATION_STEPS } from "@/lib/application-steps";
import type { UserRole } from "@/lib/db/schema/users";
import {
  decisionOutcome,
  decisionRound,
  hasRsvped,
  isDecided,
  type ApplicationDecision,
} from "@/lib/decisions";
import { cn } from "@/lib/utils";

const EASE = [0.25, 0.1, 0.25, 1] as const;

// "Has this letter been opened" lives in localStorage, which is an external
// store — so it is read through useSyncExternalStore rather than mirrored into
// state inside an effect. Backed by an in-memory set as well, so the nudge
// still settles for the session when storage is blocked (private mode).
const seenListeners = new Set<() => void>();
const seenInMemory = new Set<string>();

function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  // A letter opened in another tab should settle this one too.
  window.addEventListener("storage", listener);
  return () => {
    seenListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readSeen(key: string | null) {
  if (!key) return false;
  if (seenInMemory.has(key)) return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSeen(key: string | null) {
  if (!key) return;
  seenInMemory.add(key);
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Failing to remember across reloads isn't worth surfacing.
  }
  seenListeners.forEach((listener) => listener());
}

/**
 * Whether this decision's letter has already been opened on this device.
 *
 * Persisted so the wiggle is a one-time nudge rather than something that
 * returns on every reload. Keyed by round and outcome rather than by the raw
 * decision because RSVPing changes the decision value without changing the
 * letter — that shouldn't start it wiggling again — while a genuinely new
 * decision should.
 */
function useDecisionSeen(decision: ApplicationDecision | null) {
  const key = decision
    ? `mhacks:decision-seen:${decisionRound(decision)}:${decisionOutcome(decision)}`
    : null;

  const seen = useSyncExternalStore(
    subscribeSeen,
    useCallback(() => readSeen(key), [key]),
    // The server can't know; render the nudge and let hydration settle it.
    () => false,
  );

  const markSeen = useCallback(() => writeSeen(key), [key]);

  return { seen, markSeen };
}

/**
 * Shell over the fixed photo backdrop.
 *
 * The marketing SiteHeader is deliberately absent: it is fixed, costs ~160px of
 * clearance, and hard-codes an "Apply" CTA that misreads for someone who has
 * already applied. A slim in-page header stands in for it.
 *
 * `min-h-dvh` sits on the content rather than the outer wrapper, so the
 * dashboard itself occupies a full viewport and the footer begins below the
 * fold — the page scrolls to reach it. Being a *minimum*, a tall grid (an
 * organizer's extra tiles on a narrow screen) grows and scrolls rather than
 * being clipped.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-x-clip">
      <div className="fixed inset-0 z-0">
        <Image
          src="/hero_bg_w_overlay.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-20">
        {children}
      </div>

      <Footer variant="compact" />
    </div>
  );
}

/**
 * Sits on the dark backdrop beside the greeting, so it takes the same
 * glass-pill treatment the apply flow's sign-out uses rather than the
 * moss-on-paper styling of controls inside a tile.
 */
function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <button
      type="button"
      disabled={isSigningOut}
      onClick={async () => {
        setIsSigningOut(true);
        await logout();
      }}
      className="glass-pill font-red-hat shrink-0 cursor-pointer rounded-full px-4 py-2 text-[11px] font-semibold tracking-widest text-white/55 uppercase transition-colors hover:text-white/80 disabled:opacity-50"
    >
      {isSigningOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

/**
 * The primary tile. Four states, in the order a hacker moves through them:
 * nothing started, a saved draft, submitted and waiting, decision released.
 */
function ApplicationTile({
  decision,
  submittedAt,
  draftSteps,
  wiggle,
  onOpenLetter,
}: {
  decision: ApplicationDecision | null;
  submittedAt: string | null;
  draftSteps: number;
  /** False once the letter has been opened — the nudge has done its job. */
  wiggle: boolean;
  onOpenLetter: () => void;
}) {
  const totalSteps = APPLICATION_STEPS.length;

  // No applicant row yet — either untouched or a draft in progress.
  if (!decision) {
    const started = draftSteps > 0;

    return (
      <DashboardTile
        eyebrow="Your application"
        icon={FileTextIcon}
        className="justify-between col-span-full"
      >
        <div>
          <h1 className="font-heading mt-2 text-4xl leading-tight tracking-tight text-moss italic sm:text-5xl">
            {started ? "Pick up where you left off" : "You haven't applied yet"}
          </h1>
          <TileBody>
            {started
              ? "Your progress is saved. Finish the remaining sections whenever you're ready."
              : "Applications for MHacks 2026 are open. It takes about fifteen minutes, and you can save your progress as you go."}
          </TileBody>

          {started && (
            <div className="mt-6">
              <div className="font-red-hat mb-2 flex items-baseline justify-between text-[12px] text-moss/55">
                <span>
                  {draftSteps} of {totalSteps} sections
                </span>
                <span>{Math.round((draftSteps / totalSteps) * 100)}%</span>
              </div>
              <Meter
                value={(draftSteps / totalSteps) * 100}
                className="h-1.5"
              />
            </div>
          )}
        </div>

        <Link
          href="/apply"
          className="font-red-hat mt-8 inline-block self-start rounded-full bg-moss px-8 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-80"
        >
          {started ? "Continue your application" : "Start your application"}
        </Link>
      </DashboardTile>
    );
  }

  const decided = isDecided(decision);
  const outcome = decisionOutcome(decision);
  const rsvped = hasRsvped(decision);

  return (
    <DashboardTile
      eyebrow="Your application"
      icon={FileTextIcon}
      className="justify-between col-span-full"
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <TileTitle>Hacker Application</TileTitle>
          <TileChip solid={decided}>
            {rsvped
              ? "RSVP confirmed"
              : decided
                ? "Decision released"
                : "Under review"}
          </TileChip>
        </div>

        {submittedAt && (
          <p className="font-red-hat mt-1 text-[13px] text-moss/55">
            Submitted {format(new Date(submittedAt), "MMMM d, yyyy")}
          </p>
        )}

        <div className="my-5 h-px bg-moss/10" />

        <h1 className="font-heading text-3xl leading-tight tracking-tight text-moss italic sm:text-4xl">
          {decided
            ? outcome === "accepted"
              ? "Your decision is ready."
              : "Your decision is ready to read."
            : "Thanks — we've got it."}
        </h1>
        <TileBody>
          {decided
            ? "Open your letter for the full details."
            : "Your application has been submitted and is under review. No further changes can be made — we'll let you know as soon as a decision is released."}
        </TileBody>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {decided && (
          <button
            type="button"
            onClick={onOpenLetter}
            className={cn(
              "font-red-hat cursor-pointer rounded-full bg-moss px-7 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-80",
              // Pulls the eye to the one action that matters here, until the
              // letter has been read. Settles on hover so the target holds
              // still under the cursor.
              wiggle && "animate-wiggle hover:animate-none",
            )}
          >
            {outcome === "accepted" ? "View your decision" : "View decision"}
          </button>
        )}
        <Link
          href="/apply"
          className="font-red-hat text-[13px] text-moss/55 underline underline-offset-2 transition-colors hover:text-moss"
        >
          View your submitted application
        </Link>
      </div>
    </DashboardTile>
  );
}

export function DashboardClient({
  role,
  firstName,
  decision,
  submittedAt,
  reimbursementCents,
  draftSteps,
}: {
  role: UserRole;
  firstName: string | null;
  decision: ApplicationDecision | null;
  submittedAt: string | null;
  /** Awarded travel tier in cents, or null when there's no award. */
  reimbursementCents: number | null;
  /** Wizard sections completed in a saved draft; 0 once submitted. */
  draftSteps: number;
}) {
  const [letterOpen, setLetterOpen] = useState(false);
  const { seen, markSeen } = useDecisionSeen(decision);
  // Carries the area title through so each tile still says which part of the
  // admin surface it belongs to, now that "Organizer" has moved up to the
  // section heading.
  const adminLinks =
    role === "organizer"
      ? ADMIN_AREAS.flatMap((area) =>
          area.links.map((link) => ({ ...link, area: area.title })),
        )
      : [];

  return (
    <Shell>
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/" aria-label="MHacks home">
          <MHacksLogo size={34} />
        </Link>
        <p className="font-red-hat text-[11px] tracking-[0.2em] text-white/55 uppercase">
          MHacks 2026
        </p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-1 flex-col"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-4xl leading-tight tracking-tight text-white italic sm:text-5xl">
            {firstName ? `Hey, ${firstName}.` : "Your dashboard"}
          </h1>
          <SignOutButton />
        </div>

        <div className="mt-7 grid flex-1 auto-rows-min grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ApplicationTile
            decision={decision}
            submittedAt={submittedAt}
            draftSteps={draftSteps}
            wiggle={!seen}
            onOpenLetter={() => {
              markSeen();
              setLetterOpen(true);
            }}
          />

          {adminLinks.length > 0 && (
            // A real <section> rather than loose grid children, so the heading
            // actually labels the tiles for assistive tech instead of just
            // sitting above them. It spans the full width and runs its own
            // grid at the same breakpoints as the outer one.
            <section
              aria-labelledby="organizer-tools"
              className="col-span-full"
            >
              <div className="mt-2 mb-3 flex items-center gap-3">
                <h2
                  id="organizer-tools"
                  className="font-red-hat shrink-0 text-[11px] font-semibold tracking-[0.28em] text-white/60 uppercase"
                >
                  Organizer tools
                </h2>
                <span aria-hidden className="h-px flex-1 bg-white/15" />
                <span className="font-red-hat shrink-0 text-[11px] text-white/40">
                  Not visible to hackers
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {adminLinks.map((link) => (
                  <DashboardTile
                    key={link.href}
                    eyebrow={link.area}
                    icon={link.icon}
                    href={link.href}
                    external
                  >
                    <TileTitle>{link.title}</TileTitle>
                    <TileBody>{link.description}</TileBody>
                  </DashboardTile>
                ))}
              </div>
            </section>
          )}
        </div>
      </motion.div>

      {decision && (
        <DecisionLetterModal
          decision={decision}
          applicantName={firstName ?? "there"}
          reimbursementCents={reimbursementCents}
          open={letterOpen}
          onOpenChange={setLetterOpen}
        />
      )}
    </Shell>
  );
}
