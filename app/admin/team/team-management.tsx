"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  SearchIcon,
  Trash2Icon,
  UsersRoundIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  createUserInvite,
  listUserInvites,
  revokeUserInvite,
} from "@/lib/actions/user-invitations.server.actions";
import type { UserRole } from "@/lib/db/schema/users";
import {
  canRevokeInvite,
  INVITE_PAGE_SIZE,
  INVITE_SYNC_CHANNEL,
  INVITE_SYNC_EVENT,
  inviteStatus,
  inviteSyncPayloadSchema,
  normalizeInviteEmail,
  type UserInviteListResult,
  userInviteRoleSchema,
} from "@/lib/types/user-invitations";
import { createClient } from "@/lib/supabase/client";
import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
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

const ROLE_LABELS: Record<UserRole, string> = {
  hacker: "Hacker",
  organizer: "Organizer",
};

type Organizer = { id: string; email: string };
type SupabaseBrowserClient = ReturnType<typeof createClient>;
type InviteSyncChannel = ReturnType<SupabaseBrowserClient["channel"]>;

function isBenignRealtimeChannelError(error: unknown) {
  if (!error) return true;

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("socket closed: 1001") ||
    message.includes("socket closed") ||
    message.includes("Channel closed")
  );
}

type TeamManagementProps = {
  initialInvites: UserInviteListResult;
};

function formatInviteDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function inviteStatusBadgeClass(status: ReturnType<typeof inviteStatus>) {
  switch (status) {
    case "Accepted":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/50 dark:text-green-300";
    case "Pending":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300";
    case "Revoked":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
    case "Expired":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300";
  }
}

function inviteMetadata(invite: UserInviteListResult["items"][number]) {
  const status = inviteStatus(invite);
  const parts = [
    `Invited by ${invite.invitedByEmail}`,
    `Created ${formatInviteDate(invite.createdAt)}`,
    `Expires ${formatInviteDate(invite.expiresAt)}`,
  ];

  if (status === "Accepted" && invite.acceptedAt) {
    parts.push(`Accepted ${formatInviteDate(invite.acceptedAt)}`);
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
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [inviteConfirmation, setInviteConfirmation] =
    useState<InviteConfirmation | null>(null);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const skipSearchEffect = useRef(true);
  const searchInputRef = useRef(searchInput);
  const pageIndexRef = useRef(pageIndex);
  const supabase = useMemo(() => createClient(), []);
  const inviteSyncChannel = useRef<InviteSyncChannel | null>(null);

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
    await inviteSyncChannel.current?.send({
      type: "broadcast",
      event: INVITE_SYNC_EVENT,
      payload: {
        sourceUserId: organizer?.id ?? "",
      },
    });
  }, [organizer?.id]);

  useEffect(() => {
    let cancelled = false;

    async function syncSession(
      session: Session | null,
      mode: "full" | "refresh",
    ) {
      if (!session?.access_token) {
        await supabase.realtime.setAuth(null);
        if (cancelled) return;
        setOrganizer(null);
        setRealtimeReady(false);
        return;
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (cancelled || error || !user) {
        await supabase.realtime.setAuth(null);
        setOrganizer(null);
        setRealtimeReady(false);
        return;
      }

      if (mode === "refresh") {
        await supabase.realtime.setAuth(session.access_token);
        return;
      }

      setRealtimeReady(false);
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      setOrganizer({ id: user.id, email: user.email ?? "" });
      setRealtimeReady(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        void syncSession(session, "full");
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        void syncSession(session, "refresh");
        return;
      }

      if (event === "SIGNED_OUT") {
        void syncSession(null, "full");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!realtimeReady || !organizer) return;

    let active = true;
    let channel: InviteSyncChannel | null = null;

    channel = supabase.channel(INVITE_SYNC_CHANNEL, {
      config: { private: true },
    });
    if (!active) {
      supabase.removeChannel(channel);
      return;
    }
    inviteSyncChannel.current = channel;

    channel.on("broadcast", { event: INVITE_SYNC_EVENT }, ({ payload }) => {
      const parsed = inviteSyncPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      if (parsed.data.sourceUserId === organizer.id) return;

      void refreshInvites(pageIndexRef.current).catch((error) => {
        console.error("Unable to refresh invites after realtime sync:", error);
      });
    });

    channel.subscribe((status, err) => {
      if (!active || status !== "CHANNEL_ERROR") return;
      if (isBenignRealtimeChannelError(err)) return;
      console.error("Unable to subscribe to invite sync channel:", err);
    });

    return () => {
      active = false;
      inviteSyncChannel.current = null;
      if (channel) supabase.removeChannel(channel);
    };
  }, [organizer, realtimeReady, refreshInvites, supabase]);

  useEffect(() => {
    if (skipSearchEffect.current) {
      skipSearchEffect.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPageIndex(0);
      startSubmitTransition(async () => {
        await refreshInvites(0, searchInput.trim());
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, refreshInvites]);

  function isOwnEmail(email: string) {
    if (!organizer?.email) return false;
    return normalizeInviteEmail(email) === normalizeInviteEmail(organizer.email);
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
    if (!result) {
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

    toast.error(result.error);
  }

  function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startSubmitTransition(async () => {
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

    startSubmitTransition(async () => {
      await sendInvite(email, inviteRole, { changeExistingUserRole: true });
    });
  }

  function handleConfirmPendingInviteReplacement() {
    if (inviteConfirmation?.type !== "pending-invite") return;

    const { email, role: inviteRole } = inviteConfirmation;
    setInviteConfirmation(null);

    startSubmitTransition(async () => {
      await sendInvite(email, inviteRole, { replacePendingInvite: true });
    });
  }

  function handlePageChange(nextPageIndex: number) {
    setPageIndex(nextPageIndex);
    startSubmitTransition(async () => {
      await refreshInvites(nextPageIndex);
    });
  }

  function handleRevokeInvite(inviteId: string) {
    setRevokingInviteId(inviteId);
    startSubmitTransition(async () => {
      const result = await revokeUserInvite(inviteId);
      setRevokingInviteId(null);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Invite revoked.");
      await refreshInvites(pageIndex);
      void broadcastInviteUpdate();
    });
  }

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
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {inviteConfirmation.type === "existing-user"
                      ? "Change existing user's role?"
                      : "Replace pending invite?"}
                  </p>
                  <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
                    {inviteConfirmation.type === "existing-user" ? (
                      <>
                        <span className="font-medium text-amber-950 dark:text-amber-100">
                          {inviteConfirmation.email}
                        </span>{" "}
                        already has an account as{" "}
                        {ROLE_LABELS[inviteConfirmation.currentRole]}. Change
                        their role to {ROLE_LABELS[inviteConfirmation.role]}?
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-amber-950 dark:text-amber-100">
                          {inviteConfirmation.email}
                        </span>{" "}
                        already has a pending invite as{" "}
                        {ROLE_LABELS[inviteConfirmation.pendingRole]}. Revoke
                        that invite and send a new one as{" "}
                        {ROLE_LABELS[inviteConfirmation.role]}?
                      </>
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-background"
                      onClick={() => setInviteConfirmation(null)}
                    >
                      {inviteConfirmation.type === "existing-user"
                        ? "Keep current role"
                        : "Keep existing invite"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        inviteConfirmation.type === "existing-user"
                          ? "default"
                          : "destructive"
                      }
                      disabled={isSubmitting}
                      onClick={
                        inviteConfirmation.type === "existing-user"
                          ? handleConfirmExistingUserRoleChange
                          : handleConfirmPendingInviteReplacement
                      }
                    >
                      {inviteConfirmation.type === "existing-user"
                        ? "Change role"
                        : "Revoke and send new invite"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
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
                  isSubmitting ||
                  inviteEmail.trim().length === 0 ||
                  isOwnEmail(inviteEmail)
                }
              >
                {isSubmitting ? "Sending…" : "Send invite"}
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
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by email…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-9"
              aria-label="Search invites"
            />
          </div>
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
                            {ROLE_LABELS[invite.role]}
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
                      {canRevokeInvite(invite) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          aria-label={`Revoke invite for ${invite.email}`}
                          disabled={
                            isSubmitting && revokingInviteId === invite.id
                          }
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
