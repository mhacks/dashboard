import type { Ref } from "react";
import type { TicketState } from "@/lib/pass/types";
import { formatDef } from "@/lib/pass/formats";
import { TicketLandscape } from "@/components/pass/ticket-landscape";
import { TicketPortrait } from "@/components/pass/ticket-portrait";

export { NAME_MAX } from "@/components/pass/ticket-parts";

type Props = {
  state: TicketState;
  ticketRef?: Ref<HTMLDivElement>;
};

/** Picks the layout the chosen export format calls for. */
export function Ticket({ state, ticketRef }: Props) {
  const orientation = formatDef(state.format).orientation;

  return orientation === "portrait" ? (
    <TicketPortrait state={state} ticketRef={ticketRef} />
  ) : (
    <TicketLandscape state={state} ticketRef={ticketRef} />
  );
}
