"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilLineIcon, SearchIcon, UsersRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import { requestTeamRename } from "@/lib/actions/admin-teams.server.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function searchableText(team: AdminTeamSummary): string {
  return [team.name, ...team.members.flatMap((m) => [m.name, m.email])]
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
          <p className="text-sm text-muted-foreground">
            {teams.length} {teams.length === 1 ? "team" : "teams"} formed
          </p>
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
                    {!team.renameRequest ? (
                      <RequestRenameControl teamId={team.id} />
                    ) : null}
                  </div>
                </div>
                <ul className="grid gap-1 pl-6 text-sm sm:grid-cols-2">
                  {team.members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex items-baseline gap-2 truncate text-muted-foreground"
                    >
                      <span className="truncate text-foreground">
                        {member.name ?? member.email}
                      </span>
                      {member.name ? (
                        <span className="truncate text-xs">{member.email}</span>
                      ) : null}
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
