import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";

export default function JudgeLoading() {
  return (
    <div className="font-red-hat">
      <ConsoleShell fieldSrc="/mhacks_blue_auth_bg.png">
        <ConsolePage>
          <Masthead title="Judging" />
          <Panel eyebrow="JUDGING" status="Loading">
            <PanelHeading>Opening the floor</PanelHeading>
          </Panel>
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
