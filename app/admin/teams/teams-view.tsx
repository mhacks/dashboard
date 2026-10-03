"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LinkIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import {
  addHackerToTeam,
  createTeamForHackers,
  removeHackerFromTeam,
  requestTeamRename,
  setTeamDevpostUrl,
} from "@/lib/actions/admin-teams.server.actions";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { clampPageIndex, getPageCount, paginateSlice } from "@/lib/pagination";
import {
  MAX_TEAM_SIZE,
  TEAM_NAME_MAX_LENGTH,
  TEAM_RENAME_REASON_MAX_LENGTH,
} from "@/lib/types/teams";
import type { AdminTeamSummary } from "@/lib/types/teams";

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function RequestRenameControl({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await requestTeamRename(teamId, reason.trim() || undefined);
        toast.success("Rename requested.");
        setOpen(false);
        setReason("");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to request rename",
        );
      }
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <PencilLineIcon />
          Request rename
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (optional) — shown to the team"
          maxLength={TEAM_RENAME_REASON_MAX_LENGTH}
          className="min-h-16 text-sm"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button size="xs" onClick={submit} disabled={isPending}>
            {isPending ? "Sending…" : "Send request"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Emails separated by commas, spaces, or new lines. */
function splitEmails(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function CreateTeamDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setEmails("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createTeamForHackers(name, splitEmails(emails));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        setOpen(false);
        reset();
        router.refresh();
      } catch {
        setError("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon data-icon="inline-start" />
          Create team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            Hackers are added right away, without an invite, and the
            registration window doesn&apos;t apply. Each hacker must be checked
            in and not already on a team.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="create-team-name" className="text-sm font-medium">
              Team name
            </label>
            <Input
              id="create-team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={TEAM_NAME_MAX_LENGTH}
              disabled={isPending}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="create-team-emails" className="text-sm font-medium">
              Hacker emails (1 to {MAX_TEAM_SIZE})
            </label>
            <Textarea
              id="create-team-emails"
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder={"one@umich.edu\ntwo@umich.edu"}
              className="min-h-24 text-sm"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              One per line, or separated by commas.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={
              isPending || !name.trim() || splitEmails(emails).length === 0
            }
          >
            {isPending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddHackerControl({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await addHackerToTeam(teamId, email);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        setOpen(false);
        setEmail("");
        router.refresh();
      } catch {
        setError("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) {
          setEmail("");
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <UserPlusIcon />
          Add hacker
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Hacker's email"
            aria-label="Hacker's email"
            disabled={isPending}
            autoFocus
          />
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="xs"
              disabled={isPending || !email.trim()}
            >
              {isPending ? "Adding…" : "Add to team"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function RemoveHackerControl({
  team,
  member,
}: {
  team: AdminTeamSummary;
  member: AdminTeamSummary["members"][number];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = member.name ?? member.email;
  const isLastMember = team.members.length === 1;

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await removeHackerFromTeam(team.id, member.userId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${label} from ${team.name}`}
          title="Remove from team"
        >
          <UserMinusIcon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {label} from {team.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isLastMember
              ? "They are the last member, so the team will be deleted, along with its Devpost link, and its table will be released."
              : "They can join or create another team afterwards."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              remove();
            }}
          >
            {isPending
              ? "Removing…"
              : isLastMember
                ? "Remove and delete team"
                : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditDevpostControl({ team }: { team: AdminTeamSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(team.devpostUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(next: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setTeamDevpostUrl(team.id, next);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (next) setUrl(team.devpostUrl ?? "");
        else setError(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <LinkIcon />
          {team.devpostUrl ? "Edit Devpost" : "Add Devpost"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(url);
          }}
        >
          <Input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://devpost.com/software/project-name"
            aria-label={`Devpost link for ${team.name}`}
            disabled={isPending}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Use the public project page. The submission window and table
            requirement don&apos;t apply.
          </p>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-between gap-2">
            {team.devpostUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-destructive"
                onClick={() => save("")}
                disabled={isPending}
              >
                Remove link
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="xs"
                disabled={
                  isPending || !url.trim() || url.trim() === team.devpostUrl
                }
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function searchableText(team: AdminTeamSummary): string {
  return [
    team.name,
    team.devpostUrl,
    team.devpostUrl ? "submitted" : "not submitted",
    ...team.members.flatMap((m) => [m.name, m.email]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function TeamsView({ teams }: { teams: AdminTeamSummary[] }) {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((team) => searchableText(team).includes(query));
  }, [teams, search]);

  const safePageIndex = clampPageIndex(
    pageIndex,
    getPageCount(filteredTeams.length, PAGE_SIZE),
  );
  const visibleTeams = paginateSlice(filteredTeams, safePageIndex, PAGE_SIZE);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {teams.length} {teams.length === 1 ? "team" : "teams"} formed
            </p>
            <CreateTeamDialog />
          </div>
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPageIndex(0);
              }}
              placeholder="Search team or member"
              aria-label="Search teams"
              className="pl-9"
            />
          </div>
        </div>

        {visibleTeams.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {search.trim()
              ? "No teams match your search."
              : "No teams have been formed yet."}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {visibleTeams.map((team) => (
              <div key={team.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <UsersRoundIcon className="size-4 text-muted-foreground" />
                    <p className="font-medium">{team.name}</p>
                    <Badge variant="outline">
                      {team.members.length}/{MAX_TEAM_SIZE} members
                    </Badge>
                    {team.pendingInviteCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300"
                      >
                        {team.pendingInviteCount} pending{" "}
                        {team.pendingInviteCount === 1 ? "invite" : "invites"}
                      </Badge>
                    ) : null}
                    {team.devpostUrl ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300"
                      >
                        Submitted
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not submitted</Badge>
                    )}
                    {team.renameRequest ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="cursor-default border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300"
                          >
                            Rename requested
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {team.renameRequest.reason ?? "No reason given."} —{" "}
                          {team.renameRequest.requestedByName ?? "an organizer"}
                          , {formatDate(team.renameRequest.requestedAt)}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      Formed {formatDate(team.createdAt)}
                    </p>
                    <EditDevpostControl team={team} />
                    {team.members.length < MAX_TEAM_SIZE ? (
                      <AddHackerControl teamId={team.id} />
                    ) : null}
                    {!team.renameRequest ? (
                      <RequestRenameControl teamId={team.id} />
                    ) : null}
                  </div>
                </div>
                {team.devpostUrl ? (
                  <a
                    href={team.devpostUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pl-6 text-sm font-medium underline underline-offset-2 hover:opacity-75"
                  >
                    Devpost submission
                  </a>
                ) : null}
                <ul className="grid gap-1 pl-6 text-sm sm:grid-cols-2">
                  {team.members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex items-center gap-2 truncate text-muted-foreground"
                    >
                      <span className="truncate text-foreground">
                        {member.name ?? member.email}
                      </span>
                      {member.name ? (
                        <span className="truncate text-xs">{member.email}</span>
                      ) : null}
                      <RemoveHackerControl team={team} member={member} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <ListPagination
          pageIndex={safePageIndex}
          totalItems={filteredTeams.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPageIndex}
        />
      </CardContent>
    </Card>
  );
}
