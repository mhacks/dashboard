import Link from "next/link";

import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { db } from "@/lib/db";
import { selectTablesWithTeam } from "@/lib/db/queries/reservation";
import { isMdreddConfigured } from "@/lib/judging/mdredd";
import { getJudgingSettings } from "@/lib/queries/judging-settings";
import {
  DEFAULT_MAP_COLUMNS,
  DEFAULT_MAP_ROWS,
} from "@/lib/reservation/domain";
import { JudgeConsole } from "./judge-console";

export const dynamic = "force-dynamic";

/**
 * One pair at a time: walk to both tables, pick the stronger project, repeat.
 * The pair itself is loaded by the client, so a refresh or a busy judging
 * server shows a retry rather than a broken page.
 */
export default async function JudgePage() {
  const configured = isMdreddConfigured();
  const [tables, settings] = configured
    ? await Promise.all([selectTablesWithTeam(db), getJudgingSettings()])
    : [[], null];

  return (
    <ConsoleShell>
      <ConsolePage>
        <Masthead
          title="Judging"
          trailing={
            <Link
              href="/dashboard"
              className="font-red-hat-mono text-[11.5px] tracking-[0.02em] text-ui-ink-soft underline underline-offset-2 transition-colors hover:text-ui-ink"
            >
              Dashboard
            </Link>
          }
        />

        {configured ? (
          <JudgeConsole
            tables={tables}
            columns={settings?.mapColumns ?? DEFAULT_MAP_COLUMNS}
            rows={settings?.mapRows ?? DEFAULT_MAP_ROWS}
          />
        ) : (
          <Panel eyebrow="JUDGING" status="Not set up">
            <PanelHeading lede="This server has no judging API configured. Ask an organizer.">
              Judging is not available
            </PanelHeading>
          </Panel>
        )}
      </ConsolePage>
    </ConsoleShell>
  );
}
