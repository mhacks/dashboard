import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/console/panel";
import {
  ConsoleFooterRule,
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";

function MemberRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 border border-ui-line bg-ui-well px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
    </div>
  );
}

/** Mirrors TeamView's "has a team" shape, since that's the more common case. */
export function TeamSkeleton() {
  return (
    <div className="font-red-hat">
      <ConsoleShell fieldSrc="/mhacks_blue_auth_bg.png">
        <ConsolePage>
          <Masthead
            title="Your team"
            trailing={<Skeleton className="h-[26px] w-[74px]" />}
          />

          <Panel eyebrow="YOUR TEAM">
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2.5 h-4 w-72 max-w-full" />
            </div>

            <div className="flex flex-col gap-2">
              <MemberRowSkeleton />
              <MemberRowSkeleton />
            </div>

            <div className="flex flex-col gap-2 border-t border-ui-line pt-4">
              <Skeleton className="h-3 w-28" />
              <div className="flex flex-wrap gap-2.5">
                <Skeleton className="h-10 min-w-[200px] flex-1" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>

            <div className="border-t border-ui-line pt-4">
              <Skeleton className="h-10 w-28" />
            </div>
          </Panel>

          <Skeleton className="h-4 w-36" />

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
