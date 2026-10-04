"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { setHuntDecoy } from "@/lib/actions/hunt-codes.server.actions";
import type { HuntDecoyCandidate } from "@/lib/queries/hunt";

export function DecoyList({ roster }: { roster: HuntDecoyCandidate[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [, startSaving] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    roster,
    (rows, change: { userId: string; decoy: boolean }) =>
      rows.map((row) =>
        row.userId === change.userId ? { ...row, decoy: change.decoy } : row,
      ),
  );

  const decoyCount = optimistic.filter((row) => row.decoy).length;
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? optimistic.filter(
        (row) =>
          row.name.toLowerCase().includes(needle) ||
          row.email.toLowerCase().includes(needle),
      )
    : optimistic;

  function toggle(row: HuntDecoyCandidate, decoy: boolean) {
    startSaving(async () => {
      setOptimistic({ userId: row.userId, decoy });
      const result = await setHuntDecoy(row.userId, decoy);
      if (!result.ok) toast.error(result.message);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizers</CardTitle>
        <CardDescription>
          {decoyCount === 0
            ? "No decoys yet. Tick an organizer to make them one."
            : `${decoyCount} decoy${decoyCount === 1 ? "" : "s"}. Changes apply to the next code a hacker enters.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input
          type="search"
          placeholder="Filter by name or email"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter organizers"
        />
        <ul className="divide-y rounded-md border">
          {shown.map((row) => {
            const id = `decoy-${row.userId}`;
            return (
              <li
                key={row.userId}
                className="flex items-center gap-3 px-3 py-2"
              >
                <Checkbox
                  id={id}
                  checked={row.decoy}
                  onCheckedChange={(checked) => toggle(row, checked === true)}
                />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate text-sm font-medium">
                    {row.name}
                  </span>
                  {row.name !== row.email ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.email}
                    </span>
                  ) : null}
                </label>
                {row.decoy ? <Badge variant="destructive">Decoy</Badge> : null}
              </li>
            );
          })}
          {shown.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No organizers match.
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
