// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminReservationEventDetail } from "@/lib/queries/admin-reservations";
import type { ParticipantEvent, TableWithTeam } from "@/lib/reservation/types";

const {
  getAdminReservationEventMock,
  getTablesForEventMock,
  notFoundMock,
  randomlyAssignTableMock,
  reserveTableMock,
  routerPushMock,
  routerRefreshMock,
  toParticipantEventMock,
} = vi.hoisted(() => ({
  getAdminReservationEventMock: vi.fn(),
  getTablesForEventMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  randomlyAssignTableMock: vi.fn(),
  reserveTableMock: vi.fn(),
  routerPushMock: vi.fn(),
  routerRefreshMock: vi.fn(),
  toParticipantEventMock: vi.fn(),
}));

vi.mock("@/lib/queries/admin-reservations", () => ({
  getAdminReservationEvent: getAdminReservationEventMock,
}));

vi.mock("@/lib/db/queries/reservation", () => ({
  getTablesForEvent: getTablesForEventMock,
  toParticipantEvent: toParticipantEventMock,
}));

vi.mock("@/lib/actions/reservation", () => ({
  randomlyAssignTable: randomlyAssignTableMock,
  reserveTable: reserveTableMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({
    push: routerPushMock,
    refresh: routerRefreshMock,
  }),
}));

import ReservationParticipantPreviewPage from "./page";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

const adminEvent: AdminReservationEventDetail = {
  id: EVENT_ID,
  name: "Fall Showcase",
  description: "Demo event",
  location: "Main Hall",
  status: "open",
  startsAt: new Date("2026-09-12T17:00:00.000Z"),
  reservationsOpenAt: null,
  reservationsCloseAt: null,
  tableCount: 1,
  assignedCount: 0,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-20T00:00:00.000Z"),
};

const participantEvent: ParticipantEvent = {
  id: EVENT_ID,
  name: "Fall Showcase",
  description: "Demo event",
  location: "Main Hall",
  status: "open",
  startsAt: new Date("2026-09-12T17:00:00.000Z"),
  reservationsOpenAt: null,
  reservationsCloseAt: null,
  availability: { state: "open", canReserve: true },
};

const tables: TableWithTeam[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    number: 1,
    reservedByTeamId: null,
    reservedByTeamName: null,
  },
];

describe("ReservationParticipantPreviewPage", () => {
  beforeEach(() => {
    getAdminReservationEventMock.mockReset();
    getAdminReservationEventMock.mockResolvedValue(adminEvent);
    getTablesForEventMock.mockReset();
    getTablesForEventMock.mockResolvedValue(tables);
    notFoundMock.mockClear();
    randomlyAssignTableMock.mockReset();
    reserveTableMock.mockReset();
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
    toParticipantEventMock.mockReset();
    toParticipantEventMock.mockReturnValue(participantEvent);
  });

  afterEach(() => {
    cleanup();
  });

  it("wires organizer data into a labeled preview with no mutations", async () => {
    const page = await ReservationParticipantPreviewPage({
      params: Promise.resolve({ eventId: EVENT_ID }),
    });
    render(page);

    expect(getAdminReservationEventMock).toHaveBeenCalledWith(EVENT_ID);
    expect(getTablesForEventMock).toHaveBeenCalledWith(EVENT_ID);
    expect(toParticipantEventMock).toHaveBeenCalledWith(adminEvent);
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Organizer-only")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Participant preview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no reservation actions are available here/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Table 1, available" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /reserve table|select & reserve/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Randomly assign" }),
    ).not.toBeInTheDocument();
    expect(reserveTableMock).not.toHaveBeenCalled();
    expect(randomlyAssignTableMock).not.toHaveBeenCalled();
  });

  it("stops before participant table loading when organizer lookup fails", async () => {
    getAdminReservationEventMock.mockResolvedValue(null);

    await expect(
      ReservationParticipantPreviewPage({
        params: Promise.resolve({ eventId: EVENT_ID }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(getTablesForEventMock).not.toHaveBeenCalled();
    expect(toParticipantEventMock).not.toHaveBeenCalled();
  });
});
