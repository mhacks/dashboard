// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ParticipantEvent,
  ParticipantReservationUser,
} from "@/lib/reservation/types";

const {
  getParticipantEventsMock,
  getParticipantReservationUserMock,
  getTablesForEventMock,
  hasAcceptedReservationAccessMock,
  redirectMock,
} = vi.hoisted(() => ({
  getParticipantEventsMock: vi.fn(),
  getParticipantReservationUserMock: vi.fn(),
  getTablesForEventMock: vi.fn(),
  hasAcceptedReservationAccessMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/db/queries/reservation", () => ({
  getParticipantEvents: getParticipantEventsMock,
  getParticipantReservationUser: getParticipantReservationUserMock,
  getTablesForEvent: getTablesForEventMock,
}));

vi.mock("@/lib/reservation/access", () => ({
  hasAcceptedReservationAccess: hasAcceptedReservationAccessMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/components/reservation/reservation-board", () => ({
  ReservationBoard: () => <div>Reservation board</div>,
}));

import ReservePage from "./page";

const hacker: ParticipantReservationUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "hacker@mhacks.test",
  role: "hacker",
  teamId: "22222222-2222-4222-8222-222222222222",
  teamName: "Accepted Team",
};

const organizer: ParticipantReservationUser = {
  ...hacker,
  role: "organizer",
  teamId: null,
  teamName: null,
};

const event: ParticipantEvent = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Final judging",
  description: null,
  startsAt: null,
  location: null,
  status: "open",
  reservationsOpenAt: null,
  reservationsCloseAt: null,
  availability: { state: "open", canReserve: true },
};

describe("ReservePage access", () => {
  beforeEach(() => {
    getParticipantReservationUserMock.mockReset();
    getParticipantEventsMock.mockReset();
    getParticipantEventsMock.mockResolvedValue([event]);
    getTablesForEventMock.mockReset();
    getTablesForEventMock.mockResolvedValue([]);
    hasAcceptedReservationAccessMock.mockReset();
    redirectMock.mockClear();
  });

  afterEach(cleanup);

  it("redirects organizers before checking applicant acceptance", async () => {
    getParticipantReservationUserMock.mockResolvedValue(organizer);

    await expect(
      ReservePage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/reservations");

    expect(hasAcceptedReservationAccessMock).not.toHaveBeenCalled();
    expect(getParticipantEventsMock).not.toHaveBeenCalled();
  });

  it("redirects a non-accepted hacker before loading reservation data", async () => {
    getParticipantReservationUserMock.mockResolvedValue(hacker);
    hasAcceptedReservationAccessMock.mockResolvedValue(false);

    await expect(
      ReservePage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(hasAcceptedReservationAccessMock).toHaveBeenCalledWith(hacker.id);
    expect(getParticipantEventsMock).not.toHaveBeenCalled();
    expect(getTablesForEventMock).not.toHaveBeenCalled();
  });

  it("renders reservations for an accepted hacker", async () => {
    getParticipantReservationUserMock.mockResolvedValue(hacker);
    hasAcceptedReservationAccessMock.mockResolvedValue(true);

    const page = await ReservePage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Reservation board")).toBeInTheDocument();
    expect(getParticipantEventsMock).toHaveBeenCalledOnce();
    expect(getTablesForEventMock).toHaveBeenCalledWith(event.id);
  });
});
