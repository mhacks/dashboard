"use client";

import { useState, useTransition } from "react";
import { Trash2Icon, UsersRoundIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createUserInvite,
  listUserInvites,
  revokeUserInvite,
} from "@/lib/actions/user-invitations.server.actions";
import { INVITE_PAGE_SIZE } from "@/lib/queries/user-invitations";
import type { UserRole } from "@/lib/db/schema/users";
import type { UserInviteListResult } from "@/lib/types/user-invitations";
import {
  canRevokeInvite,
  inviteStatus,
  userInviteRoleSchema,
} from "@/lib/types/user-invitations";
import { ApplicationReviewHeader } from "@/app/admin/applications/components/application-review-header";
import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TeamManagementProps = {
  initialInvites: UserInviteListResult;
};

const ROLE_LABELS: Record<UserRole, string> = {
  hacker: "Hacker",
  organizer: "Organizer",
};

function formatDateTime(value: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TeamManagement({ initialInvites }: TeamManagementProps) {
  const [inviteData, setInviteData] = useState(initialInvites);
  const [pageIndex, setPageIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("organizer");
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  async function refreshInvites(nextPageIndex = pageIndex) {
    const updatedInvites = await listUserInvites(nextPageIndex, INVITE_PAGE_SIZE);
    setInviteData(updatedInvites);
  }

  function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startSubmitTransition(async () => {
      const result = await createUserInvite(email, role);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Invite sent.");
      setEmail("");
      setPageIndex(0);
      await refreshInvites(0);
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
    });
  }

  return (
    <AdminPageShell>
      <ApplicationReviewHeader
          title="Team"
          description="Invite users by email and assign their portal role."
          variant="dashboard"
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
              with that email. Invites expire after 7 days. Pending invites apply on
              first sign-in; existing accounts are updated immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(userInviteRoleSchema.parse(value))}
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
                  disabled={isSubmitting || email.trim().length === 0}
                >
                  {isSubmitting ? "Sending…" : "Send invite"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invites</CardTitle>
            <CardDescription>
              Pending invites can be revoked before they are accepted or expire.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {inviteData.totalCount === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No invites yet.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited by</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead className="w-[72px]">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inviteData.items.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>{ROLE_LABELS[invite.role]}</TableCell>
                        <TableCell>{inviteStatus(invite)}</TableCell>
                        <TableCell>{invite.invitedByEmail}</TableCell>
                        <TableCell>{formatDateTime(invite.createdAt)}</TableCell>
                        <TableCell>{formatDateTime(invite.expiresAt)}</TableCell>
                        <TableCell>{formatDateTime(invite.acceptedAt)}</TableCell>
                        <TableCell>
                          {canRevokeInvite(invite) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Revoke invite for ${invite.email}`}
                              disabled={
                                isSubmitting && revokingInviteId === invite.id
                              }
                              onClick={() => handleRevokeInvite(invite.id)}
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
