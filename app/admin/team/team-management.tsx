"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Trash2Icon, UsersRoundIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createUserInvite,
  listUserInvites,
  revokeUserInvite,
} from "@/lib/actions/user-invitations.server.actions";
import type { UserRole } from "@/lib/db/schema/users";
import { formatShortDate } from "@/lib/format/dates";
import {
  INVITE_PAGE_SIZE,
  INVITE_SYNC_CHANNEL,
  INVITE_SYNC_EVENT,
  inviteStatus,
  inviteSyncPayloadSchema,
  normalizeInviteEmail,
  USER_ROLE_LABELS,
  type UserInviteListResult,
  userInviteRoleSchema,
} from "@/lib/types/user-invitations";
import { createClient } from "@/lib/supabase/client";
import { sendPrivateBroadcast } from "@/lib/supabase/realtime-broadcast";
import { inviteStatusBadgeClass } from "@/lib/utils/badge-classes";
import { useOrganizerRealtimeSession } from "@/hooks/use-organizer-realtime-session";
import { usePrivateBroadcastChannel } from "@/hooks/use-private-broadcast-channel";
import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { SearchField } from "@/app/admin/components/search-field";
import { WarningCallout } from "@/app/admin/components/warning-callout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InviteConfirmation =
  | {
      type: "pending-invite";
      email: string;
      role: UserRole;
      pendingRole: UserRole;
    }
  | {
      type: "existing-user";
      email: string;
      role: UserRole;
      currentRole: UserRole;
    };

type TeamManagementProps = {
  initialInvites: UserInviteListResult;
};

function inviteMetadata(invite: UserInviteListResult["items"][number]) {
  const status = inviteStatus(invite);
  const parts = [
    `Invited by ${invite.invitedByEmail}`,
    `Created ${formatShortDate(invite.createdAt)}`,
    `Expires ${formatShortDate(invite.expiresAt)}`,
  ];

  if (status === "Accepted" && invite.acceptedAt) {
    parts.push(`Accepted ${formatShortDate(invite.acceptedAt)}`);
  }

  return parts.join(" · ");
}

export default function TeamManagement({
  initialInvites,
}: TeamManagementProps) {
  const [inviteData, setInviteData] = useState(initialInvites);
  const [pageIndex, setPageIndex] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [role, setRole] = useState<UserRole>("organizer");
  const [isSendingInvite, startSendTransition] = useTransition();
  const [, startRefreshTransition] = useTransition();
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [inviteConfirmation, setInviteConfirmation] =
    useState<InviteConfirmation | null>(null);
  const skipSearchEffect = useRef(true);
  const searchInputRef = useRef(searchInput);
  const pageIndexRef = useRef(pageIndex);
  const supabase = useMemo(() => createClient(), []);
  const inviteSyncChannel = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const { organizer, realtimeReady } = useOrganizerRealtimeSession(supabase);

  useEffect(() => {
    searchInputRef.current = searchInput;
  }, [searchInput]);

  useEffect(() => {
    pageIndexRef.current = pageIndex;
  }, [pageIndex]);

  const refreshInvites = useCallback(
    async (nextPageIndex: number, query?: string) => {
      const updatedInvites = await listUserInvites(
        nextPageIndex,
        INVITE_PAGE_SIZE,
        query ?? searchInputRef.current.trim(),
      );
      setInviteData(updatedInvites);
    },
    [],
  );

  const broadcastInviteUpdate = useCallback(async () => {
    if (!organizer?.id) return;

    await sendPrivateBroadcast(inviteSyncChannel.current, INVITE_SYNC_EVENT, {
      sourceUserId: organizer.id,
    });
  }, [organizer]);

  usePrivateBroadcastChannel({
    supabase,
    channelName: INVITE_SYNC_CHANNEL,
    event: INVITE_SYNC_EVENT,
    payloadSchema: inviteSyncPayloadSchema,
    organizerId: organizer?.id,
    realtimeReady,
    channelRef: inviteSyncChannel,
    onRemoteMessage: () => {
      void refreshInvites(pageIndexRef.current).catch((error) => {
        console.error("Unable to refresh invites after realtime sync:", error);
      });
    },
    logLabel: "invite sync channel",
  });

  useEffect(() => {
    if (skipSearchEffect.current) {
      skipSearchEffect.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPageIndex(0);
      startRefreshTransition(async () => {
        await refreshInvites(0, searchInput.trim());
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, refreshInvites]);

  function isOwnEmail(email: string) {
    if (!organizer?.email) return false;
    return (
      normalizeInviteEmail(email) === normalizeInviteEmail(organizer.email)
    );
  }

  async function sendInvite(
    email: string,
    inviteRole: UserRole,
    options?: {
      replacePendingInvite?: boolean;
      changeExistingUserRole?: boolean;
    },
  ) {
    if (isOwnEmail(email)) {
      toast.error("You cannot change your own role.");
      return;
    }

    const result = await createUserInvite(email, inviteRole, options);
    if ("ok" in result && result.ok) {
      toast.success(
        options?.changeExistingUserRole ? "Role updated." : "Invite sent.",
      );
      setInviteEmail("");
      setPageIndex(0);
      await refreshInvites(0);
      void broadcastInviteUpdate();
      return;
    }

    if ("existingUser" in result) {
      setInviteConfirmation({
        type: "existing-user",
        email,
        role: inviteRole,
        currentRole: result.existingUser.role,
      });
      return;
    }

    if ("pendingInvite" in result) {
      setInviteConfirmation({
        type: "pending-invite",
        email,
        role: inviteRole,
        pendingRole: result.pendingInvite.role,
      });
      return;
    }

    if ("error" in result) {
      toast.error(result.error);
    }
  }

  function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startSendTransition(async () => {
      await sendInvite(inviteEmail, role);
    });
  }

  function handleConfirmExistingUserRoleChange() {
    if (inviteConfirmation?.type !== "existing-user") return;

    const { email, role: inviteRole } = inviteConfirmation;
    if (isOwnEmail(email)) {
      setInviteConfirmation(null);
      toast.error("You cannot change your own role.");
      return;
    }
    setInviteConfirmation(null);

    startSendTransition(async () => {
      await sendInvite(email, inviteRole, { changeExistingUserRole: true });
    });
  }

  function handleConfirmPendingInviteReplacement() {
    if (inviteConfirmation?.type !== "pending-invite") return;

    const { email, role: inviteRole } = inviteConfirmation;
    setInviteConfirmation(null);

    startSendTransition(async () => {
      await sendInvite(email, inviteRole, { replacePendingInvite: true });
    });
  }

  function handlePageChange(nextPageIndex: number) {
    setPageIndex(nextPageIndex);
    startRefreshTransition(async () => {
      await refreshInvites(nextPageIndex);
    });
  }

  function handleRevokeInvite(inviteId: string) {
    setRevokingInviteId(inviteId);
    void (async () => {
      const result = await revokeUserInvite(inviteId);
      setRevokingInviteId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Invite revoked.");
      await refreshInvites(pageIndex);
      void broadcastInviteUpdate();
    })();
  }

  const isExistingUserConfirmation =
    inviteConfirmation?.type === "existing-user";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="User invites"
        description="Invite users by email and assign their portal role."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRoundIcon className="size-5" />
            Send invite
          </CardTitle>
          <CardDescription>
            Invited users sign in at{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/login</code>{" "}
            with that email. Invites expire after 7 days. Pending invites apply
            on first sign-in; existing accounts are prompted before their role
            changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {inviteConfirmation ? (
            <WarningCallout
              title={
                isExistingUserConfirmation
                  ? "Change existing user's role?"
                  : "Replace pending invite?"
              }
              actions={
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-background"
                    onClick={() => setInviteConfirmation(null)}
                  >
                    {isExistingUserConfirmation
                      ? "Keep current role"
                      : "Keep existing invite"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      isExistingUserConfirmation ? "default" : "destructive"
                    }
                    disabled={isSendingInvite}
                    onClick={
                      isExistingUserConfirmation
                        ? handleConfirmExistingUserRoleChange
                        : handleConfirmPendingInviteReplacement
                    }
                  >
                    {isExistingUserConfirmation
                      ? "Change role"
                      : "Revoke and send new invite"}
                  </Button>
                </>
              }
            >
              {isExistingUserConfirmation ? (
                <>
                  <span className="font-medium text-amber-950 dark:text-amber-100">
                    {inviteConfirmation.email}
                  </span>{" "}
                  already has an account as{" "}
                  {USER_ROLE_LABELS[inviteConfirmation.currentRole]}. Change
                  their role to {USER_ROLE_LABELS[inviteConfirmation.role]}?
                </>
              ) : (
                <>
                  <span className="font-medium text-amber-950 dark:text-amber-100">
                    {inviteConfirmation.email}
                  </span>{" "}
                  already has a pending invite as{" "}
                  {USER_ROLE_LABELS[inviteConfirmation.pendingRole]}. Revoke
                  that invite and send a new one as{" "}
                  {USER_ROLE_LABELS[inviteConfirmation.role]}?
                </>
              )}
            </WarningCallout>
          ) : null}
          <form
            onSubmit={handleInviteSubmit}
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="reviewer@example.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(value) =>
                  setRole(userInviteRoleSchema.parse(value))
                }
              >
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Choose role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="hacker">Hacker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={
                  isSendingInvite ||
                  inviteEmail.trim().length === 0 ||
                  isOwnEmail(inviteEmail)
                }
              >
                {isSendingInvite ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Invites</CardTitle>
            <CardDescription>
              Pending invites can be revoked before they are accepted or expire.
            </CardDescription>
          </div>
          <SearchField
            className="sm:max-w-xs"
            placeholder="Search by email…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search invites"
          />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {inviteData.totalCount === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              {searchInput.trim()
                ? "No invites match your search."
                : "No invites yet."}
            </p>
          ) : (
            <>
              <div className="divide-y divide-border/60">
                {inviteData.items.map((invite) => {
                  const status = inviteStatus(invite);

                  return (
                    <div
                      key={invite.id}
                      className="flex items-start justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {invite.email}
                          </p>
                          <Badge variant="outline">
                            {USER_ROLE_LABELS[invite.role]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={inviteStatusBadgeClass(status)}
                          >
                            {status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {inviteMetadata(invite)}
                        </p>
                      </div>
                      {inviteStatus(invite) === "Pending" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          aria-label={`Revoke invite for ${invite.email}`}
                          disabled={revokingInviteId === invite.id}
                          onClick={() => handleRevokeInvite(invite.id)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <ListPagination
                pageIndex={pageIndex}
                totalItems={inviteData.totalCount}
                pageSize={INVITE_PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
