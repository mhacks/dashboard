// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ParticipantEvent,
  ParticipantReservationUser,
  TableWithTeam,
} from "@/lib/reservation/types";
import { ReservationBoard } from "./reservation-board";

const {
  randomlyAssignTableMock,
  refreshMock,
  reserveTableMock,
  routerPushMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  randomlyAssignTableMock: vi.fn(),
  refreshMock: vi.fn(),
  reserveTableMock: vi.fn(),
  routerPushMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/lib/actions/reservation", () => ({
  randomlyAssignTable: randomlyAssignTableMock,
  reserveTable: reserveTableMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_ID = "22222222-2222-4222-8222-222222222222";
const TABLE_ID = "33333333-3333-4333-8333-333333333333";

const event: ParticipantEvent = {
  id: EVENT_ID,
  name: "Fall Showcase",
  description: "Demo event",
  startsAt: new Date("2026-09-12T17:00:00.000Z"),
  location: "Main Hall",
  status: "open",
  reservationsOpenAt: null,
  reservationsCloseAt: null,
  availability: { state: "open", canReserve: true },
};

const user: ParticipantReservationUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "hacker@example.com",
  role: "hacker",
  teamId: TEAM_ID,
  teamName: "Team Ada",
};

const tables: TableWithTeam[] = [
  {
    id: TABLE_ID,
    number: 1,
    reservedByTeamId: null,
    reservedByTeamName: null,
  },
];

function renderBoard(readOnly = false) {
  return render(
    <ReservationBoard
      events={[event]}
      user={user}
      tables={tables}
      selectedEventId={EVENT_ID}
      readOnly={readOnly}
    />,
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("ReservationBoard", () => {
  beforeEach(() => {
    randomlyAssignTableMock.mockReset();
    randomlyAssignTableMock.mockResolvedValue({
      ok: true,
      message: "Random table reserved.",
    });
    reserveTableMock.mockReset();
    reserveTableMock.mockResolvedValue({
      ok: true,
      message: "Table reserved.",
    });
    refreshMock.mockReset();
    routerPushMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the authoritative team name exactly once", () => {
    renderBoard();

    const identity = [
      ...document.querySelectorAll('[data-slot="card-description"]'),
    ].find((description) => description.textContent?.includes(user.email));
    expect(identity).toHaveTextContent(/^hacker@example\.com · Team Ada$/);
    expect(identity?.textContent?.match(/Team Ada/g)).toHaveLength(1);
  });

  it("keeps normal participant table and reservation controls interactive", async () => {
    renderBoard();

    const table = screen.getByRole("button", { name: "Table 1, available" });
    expect(table).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Select & reserve" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Randomly assign" }),
    ).toBeEnabled();

    fireEvent.click(table);
    const reserve = screen.getByRole("button", { name: "Reserve table 1" });
    expect(reserve).toBeEnabled();
    fireEvent.click(reserve);

    await waitFor(() => {
      expect(reserveTableMock).toHaveBeenCalledWith({ tableId: TABLE_ID });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Table reserved.");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("removes participant mutations and disables the map when read-only", () => {
    renderBoard(true);

    expect(
      screen.getAllByText("Reservations are read-only in this view."),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Table 1, available" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /reserve/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Randomly assign" }),
    ).not.toBeInTheDocument();
    expect(reserveTableMock).not.toHaveBeenCalled();
    expect(randomlyAssignTableMock).not.toHaveBeenCalled();
  });

  it("shows read-only preview copy instead of a sign-in prompt", () => {
    render(
      <ReservationBoard
        events={[event]}
        user={null}
        tables={tables}
        selectedEventId={EVENT_ID}
        readOnly
      />,
    );

    expect(
      screen.getAllByText("Reservations are read-only in this view."),
    ).toHaveLength(2);
    expect(
      screen.queryByText("Sign in to reserve a table."),
    ).not.toBeInTheDocument();
  });

  it("locks mutation controls while pending and reports reservation errors", async () => {
    const request = deferred<{ ok: false; error: string }>();
    reserveTableMock.mockReturnValue(request.promise);
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Table 1, available" }));
    fireEvent.click(screen.getByRole("button", { name: "Reserve table 1" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Reserve table 1" }),
      ).toBeDisabled();
    });
    expect(
      screen.getByRole("button", { name: "Randomly assign" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Table 1, selected" }),
    ).toBeDisabled();

    request.resolve({ ok: false, error: "That table was just taken." });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("That table was just taken.");
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
