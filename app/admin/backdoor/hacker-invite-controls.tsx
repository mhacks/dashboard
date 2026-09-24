"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ClipboardCheckIcon,
  Clock3Icon,
  MailCheckIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  acceptInvitedApplicantAction,
  createApplicationInvitationAction,
  revokeApplicationInvitationAction,
} from "@/lib/actions/application-invitations.server.actions";
import { decisionOutcome } from "@/lib/decisions";
import {
  APPLICATION_INVITATION_MAX_DURATION_HOURS,
  type AdminApplicationInvitation,
} from "@/lib/types/application-invitations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadge(invitation: AdminApplicationInvitation) {
  if (
    invitation.applicationDecision &&
    decisionOutcome(invitation.applicationDecision) === "accepted"
  ) {
    return <Badge>Accepted</Badge>;
  }
  if (
    invitation.applicationDecision &&
    decisionOutcome(invitation.applicationDecision) === "rejected"
  ) {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  if (invitation.status === "active") return <Badge>Active</Badge>;
  if (invitation.status === "applied") {
    return <Badge variant="secondary">Applied</Badge>;
  }
  if (invitation.status === "expired") {
    return <Badge variant="secondary">Expired</Badge>;
  }
  return <Badge variant="outline">Revoked</Badge>;
}

function searchableText(invitation: AdminApplicationInvitation) {
  return [
    invitation.email,
    invitation.applicationName ?? "",
    invitation.note ?? "",
    invitation.createdByEmail ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function HackerInviteControls({
  initialInvitations,
}: {
  initialInvitations: AdminApplicationInvitation[];
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [durationHours, setDurationHours] = useState("168");
  const [note, setNote] = useState("");
  const [autoAccept, setAutoAccept] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, startCreateTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevoking, startRevokeTransition] = useTransition();
  const [pendingDecision, setPendingDecision] =
    useState<AdminApplicationInvitation | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const filteredInvitations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return invitations;
    return invitations.filter((invitation) =>
      searchableText(invitation).includes(query),
    );
  }, [invitations, search]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startCreateTransition(async () => {
      const result = await createApplicationInvitationAction({
        email,
        durationHours,
        note,
        autoAccept,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setInvitations((current) => [
        result.invitation,
        ...current.filter((item) => item.id !== result.invitation.id),
      ]);
      setEmail("");
      setDurationHours("168");
      setNote("");
      setAutoAccept(false);
      setOpen(false);
      if (result.emailSent) {
        toast.success(`Application invite sent to ${result.invitation.email}.`);
      } else {
        toast.warning(
          `Access was granted to ${result.invitation.email}, but the email could not be sent.`,
        );
      }
    });
  }

  function revokeInvitation(invitation: AdminApplicationInvitation) {
    setRevokingId(invitation.id);
    startRevokeTransition(async () => {
      const result = await revokeApplicationInvitationAction({
        id: invitation.id,
      });
      setRevokingId(null);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const now = new Date().toISOString();
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitation.id
            ? { ...item, revokedAt: now, updatedAt: now, status: "revoked" }
            : item,
        ),
      );
      toast.success(`Application invite revoked for ${invitation.email}.`);
    });
  }

  async function acceptAndSendDecision() {
    if (!pendingDecision) return;

    setIsAccepting(true);
    try {
      const result = await acceptInvitedApplicantAction({
        invitationId: pendingDecision.id,
      });

      if (!result.ok) {
        toast.error(result.message);
        setPendingDecision(null);
        return;
      }

      setInvitations((current) =>
        current.map((invitation) =>
          invitation.id === pendingDecision.id
            ? { ...invitation, applicationDecision: result.decision }
            : invitation,
        ),
      );
      setPendingDecision(null);

      if (!result.emailSent) {
        toast.warning(
          result.newlyAccepted
            ? "Applicant accepted, but the email failed. Use Resend email to try again."
            : "Acceptance email failed to send. Please try again.",
        );
      } else {
        toast.success(
          result.newlyAccepted
            ? "Applicant accepted and decision email sent."
            : "Acceptance email resent.",
        );
      }
    } catch (error) {
      console.error("Unable to accept invited applicant:", error);
      toast.error("Unable to accept this applicant. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <CardTitle>Hacker Invites</CardTitle>
          <CardDescription>
            Invite someone who did not apply to use a private application window
            after applications close.
          </CardDescription>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button">
              <PlusIcon data-icon="inline-start" />
              Invite Hacker
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <form className="flex min-h-full flex-col" onSubmit={onSubmit}>
              <SheetHeader>
                <SheetTitle>Invite Hacker</SheetTitle>
                <SheetDescription>
                  This emails a private sign-in link and opens applications for
                  one address.
                </SheetDescription>
              </SheetHeader>

              <div className="grid gap-4 px-4">
                <div className="grid gap-2">
                  <Label htmlFor="hacker-invite-email">Hacker email</Label>
                  <Input
                    id="hacker-invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="person@example.com"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="hacker-invite-hours">
                    Application window
                  </Label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Input
                      id="hacker-invite-hours"
                      type="number"
                      min={1}
                      max={APPLICATION_INVITATION_MAX_DURATION_HOURS}
                      value={durationHours}
                      onChange={(event) => setDurationHours(event.target.value)}
                      required
                    />
                    <div className="flex h-8 items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground">
                      hours
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="hacker-invite-note">Internal note</Label>
                  <Textarea
                    id="hacker-invite-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Reason, owner, or context"
                    rows={4}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <Checkbox
                    checked={autoAccept}
                    onCheckedChange={(value) => setAutoAccept(value === true)}
                  />
                  <span>
                    <span className="font-medium">
                      Auto-accept after submission
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Release their acceptance and send the decision email as
                      soon as this invited hacker submits.
                    </span>
                  </span>
                </label>
              </div>

              <SheetFooter>
                <Button type="submit" disabled={isCreating}>
                  <Clock3Icon data-icon="inline-start" />
                  {isCreating ? "Sending..." : "Send Application Invite"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </CardHeader>

      <CardContent className="grid gap-4 p-0">
        <div className="px-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search hacker invites"
              aria-label="Search hacker application invitations"
              className="pl-9"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hacker</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Invited by</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvitations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-28 text-center text-muted-foreground"
                >
                  No hacker invites match this view.
                </TableCell>
              </TableRow>
            ) : (
              filteredInvitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="font-medium">
                      {invitation.applicationName ?? invitation.email}
                    </div>
                    {invitation.applicationName ? (
                      <div className="text-xs text-muted-foreground">
                        {invitation.email}
                      </div>
                    ) : null}
                    {invitation.autoAccept ? (
                      <div className="mt-1 text-xs font-medium text-moss dark:text-sage">
                        Auto-accept enabled
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{statusBadge(invitation)}</TableCell>
                  <TableCell>{formatDateTime(invitation.expiresAt)}</TableCell>
                  <TableCell>{formatDateTime(invitation.createdAt)}</TableCell>
                  <TableCell>{invitation.createdByEmail ?? "—"}</TableCell>
                  <TableCell className="max-w-72 truncate">
                    {invitation.note || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {invitation.status === "applied" &&
                      invitation.applicationSlug ? (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/admin/applications/${invitation.applicationSlug}`}
                          >
                            <ClipboardCheckIcon data-icon="inline-start" />
                            Review
                          </Link>
                        </Button>
                      ) : null}
                      {invitation.status === "applied" &&
                      invitation.applicationDecision !== null &&
                      decisionOutcome(invitation.applicationDecision) !==
                        "rejected" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setPendingDecision(invitation)}
                        >
                          <MailCheckIcon data-icon="inline-start" />
                          {invitation.applicationDecision === "applied"
                            ? "Accept & email"
                            : "Resend email"}
                        </Button>
                      ) : invitation.status !== "applied" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            invitation.status !== "active" ||
                            (isRevoking && revokingId === invitation.id)
                          }
                          onClick={() => revokeInvitation(invitation)}
                        >
                          <RotateCcwIcon data-icon="inline-start" />
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open && !isAccepting) setPendingDecision(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <MailCheckIcon className="text-moss dark:text-sage" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {pendingDecision?.applicationDecision === "applied"
                ? "Accept and send decision email?"
                : "Resend acceptance email?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision
                ? pendingDecision.applicationDecision === "applied"
                  ? `${pendingDecision.applicationName ?? pendingDecision.email} will be accepted. Their decision letter will go live immediately, and the acceptance email will be sent to ${pendingDecision.email}.`
                  : `The acceptance email will be sent again to ${pendingDecision.email}. Their admission decision will not change.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAccepting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isAccepting}
              onClick={acceptAndSendDecision}
            >
              <MailCheckIcon className="size-4" />
              {isAccepting
                ? pendingDecision?.applicationDecision === "applied"
                  ? "Accepting & sending…"
                  : "Sending…"
                : pendingDecision?.applicationDecision === "applied"
                  ? "Accept & send email"
                  : "Resend email"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
