import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2Icon, Clock3Icon, LockKeyholeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getAttendeeRsvpState } from "@/lib/queries/rsvp";
import { RsvpPageShell } from "./rsvp-page-shell";
import RsvpForm from "./rsvp-form";
import { RsvpSummary } from "./rsvp-summary";
import { formatMediumDateTime } from "@/lib/format/date";
import { EVENT } from "@/lib/config/event";

export const dynamic = "force-dynamic";

function StateCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="glass-card w-full max-w-2xl rounded-3xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-moss/10 text-moss">
          {icon}
        </div>
        <h1 className="mt-4 font-heading text-4xl italic text-moss sm:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-red-hat text-sm leading-6 text-moss/65">
          {description}
        </p>
      </div>
      {children}
    </main>
  );
}

export default async function RsvpPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/rsvp")}`);
  }

  const state = await getAttendeeRsvpState({
    userId: user.id,
    accountEmail: user.email,
  });

  if (state.kind === "not-eligible") {
    return (
      <RsvpPageShell>
        <StateCard
          icon={<LockKeyholeIcon />}
          title="RSVP Not Available"
          description={`An accepted ${EVENT.fullName} application is required before you can complete this RSVP.`}
        >
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/apply">View application</Link>
            </Button>
          </div>
        </StateCard>
      </RsvpPageShell>
    );
  }

  if (state.kind === "submitted") {
    return (
      <RsvpPageShell>
        <StateCard
          icon={<CheckCircle2Icon />}
          title="RSVP Submitted!"
          description={`Your spot is confirmed. This response was submitted ${formatMediumDateTime(
            state.submittedAt,
          )} and can no longer be changed.`}
        >
          <RsvpSummary
            values={state.values}
            reimbursementCents={state.reimbursementCents}
            receiptHref={state.values.receipt ? "/rsvp/receipt" : undefined}
          />
        </StateCard>
      </RsvpPageShell>
    );
  }

  if (state.kind === "closed") {
    return (
      <RsvpPageShell>
        <StateCard
          icon={<Clock3Icon />}
          title="RSVPs Are Closed"
          description="The RSVP deadline has passed. Your saved draft is shown below, but it can no longer be changed or submitted."
        >
          <RsvpSummary
            values={state.draft}
            reimbursementCents={state.reimbursementCents}
            travelStepIndex={state.travelEligibility.showTravelStep ? 1 : null}
            waiversStepIndex={state.travelEligibility.showTravelStep ? 2 : 1}
          />
        </StateCard>
      </RsvpPageShell>
    );
  }

  return (
    <RsvpForm
      draft={state.draft}
      accountEmail={state.accountEmail}
      travelEligibility={state.travelEligibility}
      draftVersion={state.draftVersion}
      reimbursementCents={state.reimbursementCents}
    />
  );
}
