"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Caret } from "@/components/console/button";
import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsoleFooterRule,
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import {
  createTeam,
  inviteToTeam,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  leaveTeam,
} from "@/lib/actions/team.server.actions";
import {
  MAX_TEAM_SIZE,
  teamNameSchema,
  inviteEmailSchema,
  type TeamWithMembers,
  type PendingInvitationSummary,
  type SentInvitationSummary,
} from "@/lib/types/teams";

interface TeamViewProps {
  currentUserId: string;
  team: TeamWithMembers | null;
  pendingInvitations: PendingInvitationSummary[];
  sentInvitations: SentInvitationSummary[];
}

const INPUT_CLASS =
  "w-full min-w-0 flex-1 rounded-[2px] border border-ui-line-strong bg-ui-paper px-3 py-2.5 font-red-hat-mono text-[13px] text-ui-ink placeholder:text-ui-ink-soft focus:outline-2 focus:outline-offset-2 focus:outline-ui-ink disabled:opacity-50";

const ACTION_BUTTON =
  "shrink-0 cursor-pointer rounded-[2px] border px-3.5 py-2 font-red-hat-mono text-[12px] tracking-[0.02em] whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink disabled:cursor-not-allowed disabled:opacity-50";
const ACTION_PRIMARY = `${ACTION_BUTTON} border-ui-ink bg-ui-ink text-ui-surface hover:opacity-90`;
const ACTION_OUTLINE = `${ACTION_BUTTON} border-ui-line-strong bg-transparent text-ui-ink hover:bg-ui-selected`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const createTeamFormSchema = z.object({ name: teamNameSchema });
type CreateTeamFormValues = z.infer<typeof createTeamFormSchema>;

const inviteFormSchema = z.object({ email: inviteEmailSchema });
type InviteFormValues = z.infer<typeof inviteFormSchema>;

/** The quiet way back to the dashboard, matching ViewApplicationLink's treatment. */
function BackToDashboardLink() {
  return (
    <Link
      href="/dashboard"
      className="font-red-hat-mono text-[11.5px] tracking-[0.02em] text-ui-ink-soft underline underline-offset-2 transition-colors hover:text-ui-ink"
    >
      Back to dashboard
    </Link>
  );
}

export function TeamView({
  currentUserId,
  team,
  pendingInvitations,
  sentInvitations,
}: TeamViewProps) {
  const [isPending, startTransition] = useTransition();
  // Tracks which specific action is in flight (e.g. "accept:<id>",
  // "cancel:<id>", "leave") so one button's loading state doesn't gate
  // every other button on the page — mirrors connections-list.tsx's
  // revokingId pattern, generalized to more than one action kind.
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const createForm = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamFormSchema),
    defaultValues: { name: "" },
  });

  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { email: "" },
  });

  function runAction(key: string, fn: () => Promise<void>) {
    setPendingKey(key);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        toast.error(errorMessage(err, "Something went wrong."));
      } finally {
        setPendingKey(null);
      }
    });
  }

  const onCreateTeam = createForm.handleSubmit((values) => {
    runAction("create", async () => {
      await createTeam(values.name);
      toast.success("Team created.");
    });
  });

  const onInvite = inviteForm.handleSubmit((values) => {
    runAction("invite", async () => {
      await inviteToTeam(values.email);
      toast.success("Invitation sent.");
      inviteForm.reset();
    });
  });

  function onAccept(invitation: PendingInvitationSummary) {
    runAction(`accept:${invitation.id}`, async () => {
      await acceptInvitation(invitation.id);
      toast.success(`Joined ${invitation.teamName}.`);
    });
  }

  function onDecline(invitation: PendingInvitationSummary) {
    runAction(`decline:${invitation.id}`, async () => {
      await declineInvitation(invitation.id);
      toast.success("Invitation declined.");
    });
  }

  function onCancel(invitation: SentInvitationSummary) {
    runAction(`cancel:${invitation.id}`, async () => {
      await cancelInvitation(invitation.id);
      toast.success("Invitation cancelled.");
    });
  }

  function onLeave() {
    const prompt =
      team && team.members.length <= 1
        ? "Leave this team? You're the last member, so the team will be deleted."
        : "Leave this team? You'll need a new invitation to rejoin.";
    if (!window.confirm(prompt)) return;

    runAction("leave", async () => {
      await leaveTeam();
      toast.success("You left the team.");
    });
  }

  return (
    <div className="font-red-hat">
      <ConsoleShell fieldSrc="/mhacks_blue_auth_bg.png">
        <ConsolePage>
          <Masthead title="Your team" trailing={<SignOutButton />} />

          <Panel
            eyebrow="YOUR TEAM"
            status={
              team
                ? `${team.members.length}/${MAX_TEAM_SIZE} members`
                : "No team yet"
            }
          >
            {team ? (
              <PanelHeading
                lede={
                  team.members.length >= MAX_TEAM_SIZE
                    ? "Your team is full."
                    : `Invite up to ${MAX_TEAM_SIZE} people total to hack together.`
                }
              >
                {team.team.name}
              </PanelHeading>
            ) : (
              <PanelHeading lede="Create a team or accept an invitation to join one.">
                Find your team
              </PanelHeading>
            )}

            {team ? (
              <>
                <MemberList
                  members={team.members}
                  currentUserId={currentUserId}
                />

                {team.members.length < MAX_TEAM_SIZE ? (
                  <InviteForm
                    form={inviteForm}
                    onSubmit={onInvite}
                    isPending={isPending}
                    isSending={pendingKey === "invite"}
                  />
                ) : null}

                {sentInvitations.length > 0 ? (
                  <SentInvitationsList
                    invitations={sentInvitations}
                    isPending={isPending}
                    pendingKey={pendingKey}
                    onCancel={onCancel}
                  />
                ) : null}

                <div className="border-t border-ui-line pt-4">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={onLeave}
                    className={ACTION_OUTLINE}
                  >
                    {pendingKey === "leave" ? "Leaving…" : "Leave team"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <CreateTeamForm
                  form={createForm}
                  onSubmit={onCreateTeam}
                  isPending={isPending}
                  isCreating={pendingKey === "create"}
                />

                {pendingInvitations.length > 0 ? (
                  <PendingInvitationsList
                    invitations={pendingInvitations}
                    isPending={isPending}
                    pendingKey={pendingKey}
                    onAccept={onAccept}
                    onDecline={onDecline}
                  />
                ) : (
                  <p className="border-t border-ui-line pt-4 text-sm text-ui-ink-soft">
                    You don&rsquo;t have a team yet. Create one, or wait for an
                    invite.
                  </p>
                )}
              </>
            )}
          </Panel>

          <BackToDashboardLink />

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}

/* ——— member list ————————————————————————————————————————————— */

function MemberList({
  members,
  currentUserId,
}: {
  members: TeamWithMembers["members"];
  currentUserId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {members.map((member) => (
        <div
          key={member.userId}
          className="flex items-center justify-between gap-3 border border-ui-line bg-ui-well px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate font-red-hat-mono text-[13px] font-medium text-ui-ink">
              {member.name ?? member.email}
              {member.userId === currentUserId ? " (you)" : ""}
            </p>
            <p className="truncate text-[12px] text-ui-ink-soft">
              {member.email} · joined {formatDate(member.joinedAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ——— forms —————————————————————————————————————————————————————— */

function CreateTeamForm({
  form,
  onSubmit,
  isPending,
  isCreating,
}: {
  form: UseFormReturn<CreateTeamFormValues>;
  onSubmit: () => void;
  isPending: boolean;
  isCreating: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label
        htmlFor="team-name"
        className="font-red-hat-mono text-[10.5px] tracking-[0.16em] uppercase text-ui-ink-soft"
      >
        Team name
      </label>
      <div className="flex flex-wrap gap-2.5">
        <input
          id="team-name"
          placeholder="Team Rocket"
          disabled={isPending}
          className={INPUT_CLASS}
          {...form.register("name")}
        />
        <button type="submit" disabled={isPending} className={ACTION_PRIMARY}>
          <Caret /> {isCreating ? "Creating…" : "Create"}
        </button>
      </div>
      {form.formState.errors.name ? (
        <p className="font-red-hat-mono text-[11px] text-red-700">
          {form.formState.errors.name.message}
        </p>
      ) : null}
    </form>
  );
}

function InviteForm({
  form,
  onSubmit,
  isPending,
  isSending,
}: {
  form: UseFormReturn<InviteFormValues>;
  onSubmit: () => void;
  isPending: boolean;
  isSending: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 border-t border-ui-line pt-4"
    >
      <label
        htmlFor="invite-email"
        className="font-red-hat-mono text-[10.5px] tracking-[0.16em] uppercase text-ui-ink-soft"
      >
        Invite by email
      </label>
      <div className="flex flex-wrap gap-2.5">
        <input
          id="invite-email"
          type="email"
          placeholder="teammate@example.com"
          disabled={isPending}
          className={INPUT_CLASS}
          {...form.register("email")}
        />
        <button type="submit" disabled={isPending} className={ACTION_PRIMARY}>
          <Caret /> {isSending ? "Sending…" : "Invite"}
        </button>
      </div>
      {form.formState.errors.email ? (
        <p className="font-red-hat-mono text-[11px] text-red-700">
          {form.formState.errors.email.message}
        </p>
      ) : null}
    </form>
  );
}

/* ——— invitations ———————————————————————————————————————————————— */

function SentInvitationsList({
  invitations,
  isPending,
  pendingKey,
  onCancel,
}: {
  invitations: SentInvitationSummary[];
  isPending: boolean;
  pendingKey: string | null;
  onCancel: (invitation: SentInvitationSummary) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-ui-line pt-4">
      <p className="font-red-hat-mono text-[10.5px] tracking-[0.16em] uppercase text-ui-ink-soft">
        Sent invitations
      </p>
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex items-center justify-between gap-3 border border-ui-line bg-ui-well px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate font-red-hat-mono text-[13px] font-medium text-ui-ink">
              {invitation.invitedName ?? invitation.invitedEmail}
            </p>
            <p className="truncate text-[12px] text-ui-ink-soft capitalize">
              {invitation.status} · sent {formatDate(invitation.createdAt)}
            </p>
          </div>
          {invitation.status === "pending" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onCancel(invitation)}
              className={ACTION_OUTLINE}
            >
              {pendingKey === `cancel:${invitation.id}`
                ? "Cancelling…"
                : "Cancel"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PendingInvitationsList({
  invitations,
  isPending,
  pendingKey,
  onAccept,
  onDecline,
}: {
  invitations: PendingInvitationSummary[];
  isPending: boolean;
  pendingKey: string | null;
  onAccept: (invitation: PendingInvitationSummary) => void;
  onDecline: (invitation: PendingInvitationSummary) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-ui-line pt-4">
      <p className="font-red-hat-mono text-[10.5px] tracking-[0.16em] uppercase text-ui-ink-soft">
        Invitations for you
      </p>
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-wrap items-center justify-between gap-3 border border-ui-line bg-ui-well px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate font-red-hat-mono text-[13px] font-medium text-ui-ink">
              {invitation.teamName}
            </p>
            <p className="truncate text-[12px] text-ui-ink-soft">
              from {invitation.invitedByName} ·{" "}
              {formatDate(invitation.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => onDecline(invitation)}
              className={ACTION_OUTLINE}
            >
              {pendingKey === `decline:${invitation.id}`
                ? "Declining…"
                : "Decline"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onAccept(invitation)}
              className={ACTION_PRIMARY}
            >
              <Caret />{" "}
              {pendingKey === `accept:${invitation.id}` ? "Joining…" : "Accept"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
