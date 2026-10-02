"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setTeamFormationEnabled } from "@/lib/actions/admin-teams.server.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TeamFormationToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    startTransition(async () => {
      try {
        await setTeamFormationEnabled(next);
        toast.success(
          next ? "Team formation is on." : "Team formation is off.",
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not update teams.",
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={enabled ? "default" : "secondary"}>
        {enabled ? "Enabled" : "Disabled"}
      </Badge>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={toggle}
      >
        {isPending ? "Saving…" : enabled ? "Disable teams" : "Enable teams"}
      </Button>
    </div>
  );
}
