"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

const MOSS = "#3A4A26";
const MOSS_FADED = "rgba(58,74,38,0.6)";
const BORDER = "#c8d4a8";

interface TeamViewProps {
  currentUserId: string;
  team: TeamWithMembers | null;
  pendingInvitations: PendingInvitationSummary[];
  sentInvitations: SentInvitationSummary[];
}

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
    runAction("leave", async () => {
      await leaveTeam();
      toast.success("You left the team.");
    });
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden py-12">
      <Image
        src="/mhacks_blue_auth_bg.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25"
      />
      <Card className="relative z-10 w-full max-w-xl bg-[#faf9f4]/95 border-[#c8d4a8] shadow-[0_24px_64px_-24px_rgba(31,42,22,0.55)] backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center pb-2">
          <MHacksLogo size={48} variant="green" />
          <h1
            className="mt-2 font-heading italic text-4xl tracking-tight text-center"
            style={{ color: MOSS }}
          >
            {team ? team.team.name : "Your Team"}
          </h1>
          <p
            className="mt-2 font-red-hat text-[13px] text-center"
            style={{ color: MOSS_FADED }}
          >
            {team
              ? "Invite up to 4 people total to hack together."
              : "Create a team or accept an invitation to join one."}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {team ? (
            <>
              {/* Member list */}
              <div className="flex flex-col gap-2">
                {team.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="min-w-0">
                      <p
                        className="font-red-hat text-[14px] font-medium truncate"
                        style={{ color: MOSS }}
                      >
                        {member.name ?? member.email}
                        {member.userId === currentUserId ? " (you)" : ""}
                      </p>
                      <p
                        className="font-red-hat text-[12px] truncate"
                        style={{ color: MOSS_FADED }}
                      >
                        {member.email} · joined {formatDate(member.joinedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite form / full state */}
              {team.members.length >= MAX_TEAM_SIZE ? (
                <p
                  className="font-red-hat text-[13px] text-center"
                  style={{ color: MOSS_FADED }}
                >
                  Your team is full.
                </p>
              ) : (
                <form
                  onSubmit={onInvite}
                  className="flex flex-col gap-2 border-t pt-4"
                  style={{ borderColor: BORDER }}
                >
                  <Label
                    htmlFor="invite-email"
                    className="font-red-hat text-[13px]"
                    style={{ color: MOSS }}
                  >
                    Invite by email
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@example.com"
                      disabled={isPending}
                      className="border-[#c8d4a8]"
                      {...inviteForm.register("email")}
                    />
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="shrink-0 rounded-full font-red-hat text-[13px] cursor-pointer"
                    >
                      {pendingKey === "invite" ? "Sending…" : "Invite"}
                    </Button>
                  </div>
                  {inviteForm.formState.errors.email ? (
                    <p className="font-red-hat text-[12px] text-red-700">
                      {inviteForm.formState.errors.email.message}
                    </p>
                  ) : null}
                </form>
              )}

              {/* Sent invitations */}
              {sentInvitations.length > 0 ? (
                <div
                  className="flex flex-col gap-2 border-t pt-4"
                  style={{ borderColor: BORDER }}
                >
                  <p
                    className="font-red-hat text-[13px] font-medium"
                    style={{ color: MOSS }}
                  >
                    Sent invitations
                  </p>
                  {sentInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      style={{ borderColor: BORDER }}
                    >
                      <div className="min-w-0">
                        <p
                          className="font-red-hat text-[14px] font-medium truncate"
                          style={{ color: MOSS }}
                        >
                          {invitation.invitedName ?? invitation.invitedEmail}
                        </p>
                        <p
                          className="font-red-hat text-[12px] truncate capitalize"
                          style={{ color: MOSS_FADED }}
                        >
                          {invitation.status} · sent{" "}
                          {formatDate(invitation.createdAt)}
                        </p>
                      </div>
                      {invitation.status === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => onCancel(invitation)}
                          className="shrink-0 rounded-full font-red-hat text-[13px] cursor-pointer border-[#c8d4a8]"
                          style={{ color: MOSS }}
                        >
                          {pendingKey === `cancel:${invitation.id}`
                            ? "Cancelling…"
                            : "Cancel"}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Leave team */}
              <div className="border-t pt-4" style={{ borderColor: BORDER }}>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      className="w-full rounded-full font-red-hat text-[13px] cursor-pointer border-[#c8d4a8]"
                      style={{ color: MOSS }}
                    >
                      {pendingKey === "leave" ? "Leaving…" : "Leave team"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave this team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You&apos;ll need a new invitation to rejoin. If
                        you&apos;re the last member, the team will be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onLeave}>
                        Leave team
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          ) : (
            <>
              {/* Create-team form */}
              <form onSubmit={onCreateTeam} className="flex flex-col gap-2">
                <Label
                  htmlFor="team-name"
                  className="font-red-hat text-[13px]"
                  style={{ color: MOSS }}
                >
                  Team name
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="team-name"
                    placeholder="Team Rocket"
                    disabled={isPending}
                    className="border-[#c8d4a8]"
                    {...createForm.register("name")}
                  />
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="shrink-0 rounded-full font-red-hat text-[13px] cursor-pointer"
                  >
                    {pendingKey === "create" ? "Creating…" : "Create"}
                  </Button>
                </div>
                {createForm.formState.errors.name ? (
                  <p className="font-red-hat text-[12px] text-red-700">
                    {createForm.formState.errors.name.message}
                  </p>
                ) : null}
              </form>

              {/* Pending invitations */}
              {pendingInvitations.length > 0 ? (
                <div
                  className="flex flex-col gap-2 border-t pt-4"
                  style={{ borderColor: BORDER }}
                >
                  <p
                    className="font-red-hat text-[13px] font-medium"
                    style={{ color: MOSS }}
                  >
                    Invitations for you
                  </p>
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      style={{ borderColor: BORDER }}
                    >
                      <div className="min-w-0">
                        <p
                          className="font-red-hat text-[14px] font-medium truncate"
                          style={{ color: MOSS }}
                        >
                          {invitation.teamName}
                        </p>
                        <p
                          className="font-red-hat text-[12px] truncate"
                          style={{ color: MOSS_FADED }}
                        >
                          from {invitation.invitedByName} ·{" "}
                          {formatDate(invitation.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => onDecline(invitation)}
                          className="rounded-full font-red-hat text-[13px] cursor-pointer border-[#c8d4a8]"
                          style={{ color: MOSS }}
                        >
                          {pendingKey === `decline:${invitation.id}`
                            ? "Declining…"
                            : "Decline"}
                        </Button>
                        <Button
                          type="button"
                          disabled={isPending}
                          onClick={() => onAccept(invitation)}
                          className="rounded-full font-red-hat text-[13px] cursor-pointer"
                        >
                          {pendingKey === `accept:${invitation.id}`
                            ? "Joining…"
                            : "Accept"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="font-red-hat text-[13px] text-center"
                  style={{ color: MOSS_FADED }}
                >
                  You don&apos;t have a team yet. Create one, or wait for an
                  invite.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
