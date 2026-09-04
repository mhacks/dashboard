// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminReservationAssignmentsData } from "@/lib/queries/admin-reservations";
import { AssignmentManagement } from "./assignment-management";

const {
  moveReservationTeamMock,
  refreshMock,
  toastErrorMock,
  toastSuccessMock,
  unassignReservationTeamMock,
} = vi.hoisted(() => ({
  moveReservationTeamMock: vi.fn(),
  refreshMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  unassignReservationTeamMock: vi.fn(),
}));

vi.mock("@/lib/actions/admin-reservations.server.actions", () => ({
  moveReservationTeam: moveReservationTeamMock,
  unassignReservationTeam: unassignReservationTeamMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
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
const TEAM_ALPHA_ID = "22222222-2222-4222-8222-222222222222";
const TEAM_BRAVO_ID = "33333333-3333-4333-8333-333333333333";
const TEAM_CHARLIE_ID = "44444444-4444-4444-8444-444444444444";
const TABLE_ONE_ID = "55555555-5555-4555-8555-555555555555";
const TABLE_TWO_ID = "66666666-6666-4666-8666-666666666666";
const TABLE_THREE_ID = "77777777-7777-4777-8777-777777777777";

function assignmentsData(
  options: {
    archived?: boolean;
    selectedTeam?: "assigned" | "unassigned";
  } = {},
): AdminReservationAssignmentsData {
  const assignedTeam = {
    id: TEAM_ALPHA_ID,
    name: "Team Alpha",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    tableId: TABLE_ONE_ID,
    tableNumber: 1,
  };
  const unassignedTeam = {
    id: TEAM_CHARLIE_ID,
    name: "Team Charlie",
    createdAt: new Date("2026-08-03T00:00:00.000Z"),
    tableId: null,
    tableNumber: null,
  };

  return {
    event: {
      id: EVENT_ID,
      name: "Fall Showcase",
      description: "Demo event",
      location: "Main Hall",
      status: options.archived ? "archived" : "open",
      startsAt: new Date("2026-09-12T17:00:00.000Z"),
      reservationsOpenAt: null,
      reservationsCloseAt: null,
      tableCount: 3,
      assignedCount: 2,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    },
    teams:
      options.selectedTeam === "unassigned"
        ? [
            unassignedTeam,
            assignedTeam,
            {
              id: TEAM_BRAVO_ID,
              name: "Team Bravo",
              createdAt: new Date("2026-08-02T00:00:00.000Z"),
              tableId: TABLE_TWO_ID,
              tableNumber: 2,
            },
          ]
        : [
            assignedTeam,
            {
              id: TEAM_BRAVO_ID,
              name: "Team Bravo",
              createdAt: new Date("2026-08-02T00:00:00.000Z"),
              tableId: TABLE_TWO_ID,
              tableNumber: 2,
            },
            unassignedTeam,
          ],
    tables: [
      {
        id: TABLE_ONE_ID,
        number: 1,
        reservedByTeamId: TEAM_ALPHA_ID,
        reservedByTeamName: "Team Alpha",
      },
      {
        id: TABLE_TWO_ID,
        number: 2,
        reservedByTeamId: TEAM_BRAVO_ID,
        reservedByTeamName: "Team Bravo",
      },
      {
        id: TABLE_THREE_ID,
        number: 3,
        reservedByTeamId: null,
        reservedByTeamName: null,
      },
    ],
  };
}

function clickTable(number: number) {
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`^Table ${number},`),
    }),
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("AssignmentManagement", () => {
  beforeEach(() => {
    moveReservationTeamMock.mockReset();
    moveReservationTeamMock.mockResolvedValue({
      ok: true,
      message: "Assignment updated.",
    });
    unassignReservationTeamMock.mockReset();
    unassignReservationTeamMock.mockResolvedValue({
      ok: true,
      message: "Team unassigned.",
    });
    refreshMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the team selector and current assignment", () => {
    render(<AssignmentManagement {...assignmentsData()} />);

    expect(screen.getByRole("combobox", { name: "Team" })).toHaveTextContent(
      "Team Alpha",
    );
    expect(screen.getByText("Current assignment")).toBeInTheDocument();
    expect(screen.getByText("Table 1")).toBeInTheDocument();
  });

  it("describes and confirms a move to an empty table", async () => {
    render(<AssignmentManagement {...assignmentsData()} />);

    clickTable(3);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Move Team Alpha?");
    expect(dialog).toHaveTextContent("Team Alpha");
    expect(dialog).toHaveTextContent("Table 1");
    expect(dialog).toHaveTextContent("Table 3");

    fireEvent.click(screen.getByRole("button", { name: "Move team" }));

    await waitFor(() => {
      expect(moveReservationTeamMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        teamId: TEAM_ALPHA_ID,
        tableId: TABLE_THREE_ID,
        expectedSourceTableId: TABLE_ONE_ID,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 3,
        expectedDestinationTeamId: null,
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Assignment updated.");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("describes an assignment from unassigned to an empty table", () => {
    render(
      <AssignmentManagement
        {...assignmentsData({ selectedTeam: "unassigned" })}
      />,
    );

    clickTable(3);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Assign Team Charlie?");
    expect(dialog).toHaveTextContent("Team Charlie");
    expect(dialog).toHaveTextContent("currently unassigned");
    expect(dialog).toHaveTextContent("Table 3");
  });

  it("describes both teams and tables in a swap", async () => {
    render(<AssignmentManagement {...assignmentsData()} />);

    clickTable(2);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Swap Team Alpha and Team Bravo?");
    expect(dialog).toHaveTextContent("Team Alpha");
    expect(dialog).toHaveTextContent("Table 1");
    expect(dialog).toHaveTextContent("Team Bravo");
    expect(dialog).toHaveTextContent("Table 2");

    fireEvent.click(screen.getByRole("button", { name: "Swap teams" }));
    await waitFor(() => {
      expect(moveReservationTeamMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        teamId: TEAM_ALPHA_ID,
        tableId: TABLE_TWO_ID,
        expectedSourceTableId: TABLE_ONE_ID,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 2,
        expectedDestinationTeamId: TEAM_BRAVO_ID,
      });
    });
  });

  it("describes the displaced team when assigning to an occupied table", () => {
    render(
      <AssignmentManagement
        {...assignmentsData({ selectedTeam: "unassigned" })}
      />,
    );

    clickTable(2);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Displace Team Bravo?");
    expect(dialog).toHaveTextContent("Team Charlie");
    expect(dialog).toHaveTextContent("Table 2");
    expect(dialog).toHaveTextContent("Team Bravo");
    expect(dialog).toHaveTextContent("become unassigned");
  });

  it("submits the state described when assignments refresh behind an open dialog", async () => {
    const view = render(<AssignmentManagement {...assignmentsData()} />);

    clickTable(3);
    const refreshed = assignmentsData();
    refreshed.tables = refreshed.tables.map((table) => {
      if (table.id === TABLE_ONE_ID) {
        return {
          ...table,
          number: 11,
          reservedByTeamId: null,
          reservedByTeamName: null,
        };
      }
      if (table.id === TABLE_THREE_ID) {
        return {
          ...table,
          number: 33,
          reservedByTeamId: TEAM_BRAVO_ID,
          reservedByTeamName: "Team Bravo",
        };
      }
      return table;
    });
    view.rerender(<AssignmentManagement {...refreshed} />);

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Team Alpha will move from Table 1 to empty Table 3.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Move team" }));

    await waitFor(() => {
      expect(moveReservationTeamMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        teamId: TEAM_ALPHA_ID,
        tableId: TABLE_THREE_ID,
        expectedSourceTableId: TABLE_ONE_ID,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 3,
        expectedDestinationTeamId: null,
      });
    });
  });

  it("requires confirmation before unassigning a team", async () => {
    render(<AssignmentManagement {...assignmentsData()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Unassign Team Alpha" }),
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Unassign Team Alpha?");
    expect(dialog).toHaveTextContent("Team Alpha");
    expect(dialog).toHaveTextContent("Table 1");
    expect(unassignReservationTeamMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Unassign team" }));

    await waitFor(() => {
      expect(unassignReservationTeamMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        teamId: TEAM_ALPHA_ID,
        expectedSourceTableId: TABLE_ONE_ID,
        expectedSourceTableNumber: 1,
      });
    });
  });

  it("submits the displayed unassign source after assignments refresh", async () => {
    const view = render(<AssignmentManagement {...assignmentsData()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Unassign Team Alpha" }),
    );
    const refreshed = assignmentsData();
    refreshed.tables = refreshed.tables.map((table) => {
      if (table.id === TABLE_ONE_ID) {
        return {
          ...table,
          reservedByTeamId: null,
          reservedByTeamName: null,
        };
      }
      if (table.id === TABLE_THREE_ID) {
        return {
          ...table,
          number: 30,
          reservedByTeamId: TEAM_ALPHA_ID,
          reservedByTeamName: "Team Alpha",
        };
      }
      return table;
    });
    view.rerender(<AssignmentManagement {...refreshed} />);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Team Alpha will be removed from Table 1 and become unassigned.",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Unassign team" }),
    );

    await waitFor(() => {
      expect(unassignReservationTeamMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        teamId: TEAM_ALPHA_ID,
        expectedSourceTableId: TABLE_ONE_ID,
        expectedSourceTableNumber: 1,
      });
    });
  });

  it("keeps a failed move open with its action error", async () => {
    moveReservationTeamMock.mockResolvedValue({
      ok: false,
      error: "The destination table changed. Try again.",
    });
    render(<AssignmentManagement {...assignmentsData()} />);

    clickTable(3);
    fireEvent.click(screen.getByRole("button", { name: "Move team" }));

    expect(
      await screen.findByText("The destination table changed. Try again."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("locks assignment controls while a move is pending", async () => {
    const request = deferred<{ ok: true; message: string }>();
    moveReservationTeamMock.mockReturnValue(request.promise);
    render(<AssignmentManagement {...assignmentsData()} />);

    clickTable(3);
    fireEvent.click(screen.getByRole("button", { name: "Move team" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Move team" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Unassign Team Alpha",
        hidden: true,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Table 3, selected",
        hidden: true,
      }),
    ).toBeDisabled();

    request.resolve({ ok: true, message: "Assignment updated." });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledOnce();
    });
  });

  it("disables every mutation control for archived events", () => {
    render(<AssignmentManagement {...assignmentsData({ archived: true })} />);

    expect(
      screen.getByText(/archived events are read-only/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unassign Team Alpha" }),
    ).toBeDisabled();
    for (const number of [1, 2, 3]) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^Table ${number},`),
        }),
      ).toBeDisabled();
    }
  });
});
