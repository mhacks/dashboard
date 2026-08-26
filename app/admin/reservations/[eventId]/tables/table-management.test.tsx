// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminReservationEventDetail } from "@/lib/queries/admin-reservations";
import {
  MAX_RESERVATION_TABLE_COUNT,
  MAX_RESERVATION_TABLE_NUMBER,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";
import ReservationTablesPage from "./page";
import { TableManagement } from "./table-management";

const {
  createReservationTableMock,
  deleteReservationTableMock,
  getAdminReservationTablesMock,
  notFoundMock,
  refreshMock,
  renumberReservationTableMock,
  setReservationTableCountMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  createReservationTableMock: vi.fn(),
  deleteReservationTableMock: vi.fn(),
  getAdminReservationTablesMock: vi.fn(),
  notFoundMock: vi.fn(),
  refreshMock: vi.fn(),
  renumberReservationTableMock: vi.fn(),
  setReservationTableCountMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/lib/actions/admin-reservations.server.actions", () => ({
  createReservationTable: createReservationTableMock,
  deleteReservationTable: deleteReservationTableMock,
  renumberReservationTable: renumberReservationTableMock,
  setReservationTableCount: setReservationTableCountMock,
}));

vi.mock("@/lib/queries/admin-reservations", () => ({
  getAdminReservationTables: getAdminReservationTablesMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

const openEvent: AdminReservationEventDetail = {
  id: EVENT_ID,
  name: "Fall Showcase",
  description: "Annual reservation event",
  location: "Main Hall",
  status: "open",
  startsAt: new Date("2026-09-12T17:00:00.000Z"),
  reservationsOpenAt: new Date("2026-09-01T16:00:00.000Z"),
  reservationsCloseAt: new Date("2026-09-10T16:00:00.000Z"),
  tableCount: 4,
  assignedCount: 2,
  createdAt: new Date("2026-08-01T12:00:00.000Z"),
  updatedAt: new Date("2026-08-20T12:00:00.000Z"),
};

const tables: TableWithTeam[] = [
  {
    id: "21111111-1111-4111-8111-111111111111",
    number: 1,
    reservedByTeamId: null,
    reservedByTeamName: null,
  },
  {
    id: "31111111-1111-4111-8111-111111111111",
    number: 3,
    reservedByTeamId: "71111111-1111-4111-8111-111111111111",
    reservedByTeamName: "Alpha Team",
  },
  {
    id: "41111111-1111-4111-8111-111111111111",
    number: 7,
    reservedByTeamId: "81111111-1111-4111-8111-111111111111",
    reservedByTeamName: "Beta Team",
  },
  {
    id: "51111111-1111-4111-8111-111111111111",
    number: 9,
    reservedByTeamId: null,
    reservedByTeamName: null,
  },
];

function topologyOf(eventTables: TableWithTeam[]) {
  return eventTables.map(({ id, number, reservedByTeamId }) => ({
    id,
    number,
    reservedByTeamId,
  }));
}

function renderManager({
  event = openEvent,
  eventTables = tables,
}: {
  event?: AdminReservationEventDetail;
  eventTables?: TableWithTeam[];
} = {}) {
  return render(<TableManagement event={event} tables={eventTables} />);
}

function tableCard(number: number) {
  const title = screen.getByText(`Table ${number}`, {
    selector: "[data-slot=card-title]",
  });
  const card = title.closest("[data-slot=card]");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Table ${number} card not found`);
  }
  return within(card);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("ReservationTablesPage", () => {
  it("loads the reviewed table query for the requested event", async () => {
    getAdminReservationTablesMock.mockResolvedValue({
      event: openEvent,
      tables,
    });

    const page = await ReservationTablesPage({
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(getAdminReservationTablesMock).toHaveBeenCalledWith(EVENT_ID);
    expect(page.props).toMatchObject({ event: openEvent, tables });
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("uses the not-found boundary for an invalid event", async () => {
    getAdminReservationTablesMock.mockResolvedValue(null);
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      ReservationTablesPage({
        params: Promise.resolve({ eventId: "not-an-event" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});

describe("TableManagement", () => {
  beforeEach(() => {
    createReservationTableMock.mockReset();
    deleteReservationTableMock.mockReset();
    getAdminReservationTablesMock.mockReset();
    notFoundMock.mockReset();
    refreshMock.mockReset();
    renumberReservationTableMock.mockReset();
    setReservationTableCountMock.mockReset();
    toastSuccessMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders current total, assigned, and open counts", () => {
    renderManager();

    const summary = screen.getByRole("region", { name: "Table summary" });
    expect(within(summary).getByText("4 total")).toBeInTheDocument();
    expect(within(summary).getByText("2 assigned")).toBeInTheDocument();
    expect(within(summary).getByText("2 open")).toBeInTheDocument();
  });

  it("reconciles the count control after add, delete, and count refreshes", () => {
    const view = renderManager();
    const countInput = screen.getByLabelText("Desired table count");
    fireEvent.change(countInput, { target: { value: "12" } });
    const addedTables = [
      ...tables,
      {
        id: "61111111-1111-4111-8111-111111111111",
        number: 10,
        reservedByTeamId: null,
        reservedByTeamName: null,
      },
    ];

    view.rerender(
      <TableManagement
        event={{ ...openEvent, tableCount: addedTables.length }}
        tables={addedTables}
      />,
    );
    expect(screen.getByLabelText("Desired table count")).toHaveValue(5);

    const deletedTables = addedTables.slice(0, 3);
    view.rerender(
      <TableManagement
        event={{ ...openEvent, tableCount: deletedTables.length }}
        tables={deletedTables}
      />,
    );
    expect(screen.getByLabelText("Desired table count")).toHaveValue(3);

    const countedTables = Array.from({ length: 6 }, (_, index) => ({
      id: `${String(index + 21).padStart(8, "0")}-1111-4111-8111-111111111111`,
      number: index + 1,
      reservedByTeamId: null,
      reservedByTeamName: null,
    }));
    view.rerender(
      <TableManagement
        event={{ ...openEvent, tableCount: countedTables.length }}
        tables={countedTables}
      />,
    );
    expect(screen.getByLabelText("Desired table count")).toHaveValue(6);
  });

  it("does not resurrect stale count state after a 4 to 5 to 4 refresh", async () => {
    setReservationTableCountMock.mockResolvedValue({
      ok: false,
      error: "Old count request failed.",
      fieldErrors: { count: ["Old count field error."] },
    });
    const view = renderManager();
    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set table count" }));
    expect(
      await screen.findByText("Old count request failed."),
    ).toBeInTheDocument();
    expect(screen.getByText("Old count field error.")).toBeInTheDocument();

    const fiveTables = [
      ...tables,
      {
        id: "61111111-1111-4111-8111-111111111111",
        number: 10,
        reservedByTeamId: null,
        reservedByTeamName: null,
      },
    ];
    view.rerender(
      <TableManagement
        event={{ ...openEvent, tableCount: fiveTables.length }}
        tables={fiveTables}
      />,
    );
    expect(screen.getByLabelText("Desired table count")).toHaveValue(5);
    expect(
      screen.queryByText("Old count request failed."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Old count field error."),
    ).not.toBeInTheDocument();

    view.rerender(<TableManagement event={openEvent} tables={tables} />);
    expect(screen.getByLabelText("Desired table count")).toHaveValue(4);
    expect(
      screen.queryByText("Old count request failed."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Old count field error."),
    ).not.toBeInTheDocument();
  });

  it("submits a larger desired count, then toasts and refreshes", async () => {
    setReservationTableCountMock.mockResolvedValue({
      ok: true,
      message: "Table count set to 6.",
    });
    const view = renderManager();

    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set table count" }));

    await waitFor(() => {
      expect(setReservationTableCountMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        count: 6,
        expectedTables: topologyOf(tables),
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Table count set to 6.");
    expect(refreshMock).toHaveBeenCalledOnce();

    const refreshedTables = Array.from({ length: 6 }, (_, index) => ({
      id: `${String(index + 31).padStart(8, "0")}-1111-4111-8111-111111111111`,
      number: index + 1,
      reservedByTeamId: null,
      reservedByTeamName: null,
    }));
    view.rerender(
      <TableManagement
        event={{ ...openEvent, assignedCount: 0, tableCount: 6 }}
        tables={refreshedTables}
      />,
    );
    const refreshedInput = screen.getByLabelText("Desired table count");
    expect(refreshedInput).toHaveValue(6);
    await waitFor(() => expect(refreshedInput).toHaveFocus());
  });

  it("does not treat a blank desired count as zero", () => {
    renderManager();

    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set table count" }));

    expect(
      screen.getByText("Enter a non-negative whole number."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(setReservationTableCountMock).not.toHaveBeenCalled();
  });

  it("exposes and enforces table count and number limits", () => {
    renderManager();

    const countInput = screen.getByLabelText("Desired table count");
    const addInput = screen.getByLabelText("New table number");
    const renumberInput = tableCard(1).getByLabelText("New number for table 1");
    expect(countInput).toHaveAttribute(
      "max",
      String(MAX_RESERVATION_TABLE_COUNT),
    );
    expect(countInput).toHaveAttribute("min", "0");
    expect(countInput).toHaveAttribute("step", "1");
    expect(addInput).toHaveAttribute(
      "max",
      String(MAX_RESERVATION_TABLE_NUMBER),
    );
    expect(renumberInput).toHaveAttribute(
      "max",
      String(MAX_RESERVATION_TABLE_NUMBER),
    );

    fireEvent.change(countInput, {
      target: { value: String(MAX_RESERVATION_TABLE_COUNT + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set table count" }));
    expect(
      screen.getByText(
        `Enter a whole number from 0 to ${MAX_RESERVATION_TABLE_COUNT}.`,
      ),
    ).toBeInTheDocument();

    fireEvent.change(addInput, {
      target: { value: String(MAX_RESERVATION_TABLE_NUMBER + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add table" }));
    expect(
      screen.getByText(
        `Enter a whole number from 1 to ${MAX_RESERVATION_TABLE_NUMBER.toLocaleString("en-US")}.`,
      ),
    ).toBeInTheDocument();
    expect(setReservationTableCountMock).not.toHaveBeenCalled();
    expect(createReservationTableMock).not.toHaveBeenCalled();
  });

  it("previews the highest-numbered reduction targets and every blocker", () => {
    renderManager();

    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));

    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Tables 9, 7, and 3 will be removed."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Assigned tables 3 (Alpha Team) and 7 (Beta Team) block this reduction.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Manage assignments" }),
    ).toHaveAttribute("href", `/admin/reservations/${EVENT_ID}/assignments`);
    expect(
      within(dialog).getByRole("button", { name: "Confirm reduction" }),
    ).toBeDisabled();
    expect(setReservationTableCountMock).not.toHaveBeenCalled();
  });

  it("confirms an unblocked reduction before submitting it", async () => {
    setReservationTableCountMock.mockResolvedValue({
      ok: true,
      message: "Table count set to 2.",
    });
    const openTables = tables.map((table) => ({
      ...table,
      reservedByTeamId: null,
      reservedByTeamName: null,
    }));
    const view = renderManager({
      event: { ...openEvent, assignedCount: 0 },
      eventTables: openTables,
    });

    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));

    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Tables 9 and 7 will be removed."),
    ).toBeInTheDocument();
    expect(setReservationTableCountMock).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm reduction" }),
    );

    await waitFor(() => {
      expect(setReservationTableCountMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        count: 2,
        expectedTables: topologyOf(openTables),
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Table count set to 2.");
    expect(refreshMock).toHaveBeenCalledOnce();

    view.rerender(
      <TableManagement
        event={{ ...openEvent, assignedCount: 0, tableCount: 2 }}
        tables={openTables.slice(0, 2)}
      />,
    );
    const refreshedInput = screen.getByLabelText("Desired table count");
    expect(refreshedInput).toHaveValue(2);
    await waitFor(() => expect(refreshedInput).toHaveFocus());
  });

  it("focuses the remounted count input when refresh closes a reduction", async () => {
    const openTables = tables.map((table) => ({
      ...table,
      reservedByTeamId: null,
      reservedByTeamName: null,
    }));
    const view = renderManager({
      event: { ...openEvent, assignedCount: 0 },
      eventTables: openTables,
    });
    const previousCountInput = screen.getByLabelText("Desired table count");
    fireEvent.change(previousCountInput, {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const refreshedTables = [
      ...openTables,
      {
        id: "61111111-1111-4111-8111-111111111111",
        number: 10,
        reservedByTeamId: null,
        reservedByTeamName: null,
      },
    ];
    view.rerender(
      <TableManagement
        event={{ ...openEvent, assignedCount: 0, tableCount: 5 }}
        tables={refreshedTables}
      />,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const refreshedCountInput = screen.getByLabelText("Desired table count");
    expect(refreshedCountInput).toHaveValue(5);
    expect(refreshedCountInput).not.toBe(previousCountInput);
    expect(previousCountInput.isConnected).toBe(false);
    await waitFor(() => expect(refreshedCountInput).toHaveFocus());
  });

  it("invalidates a pending reduction when refreshed table count changes", async () => {
    const request = deferred<{ ok: true; message: string }>();
    setReservationTableCountMock.mockReturnValue(request.promise);
    const openTables = tables.map((table) => ({
      ...table,
      reservedByTeamId: null,
      reservedByTeamName: null,
    }));
    const view = renderManager({
      event: { ...openEvent, assignedCount: 0 },
      eventTables: openTables,
    });
    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Confirm reduction",
      }),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const refreshedTables = [
      ...openTables,
      {
        id: "61111111-1111-4111-8111-111111111111",
        number: 10,
        reservedByTeamId: null,
        reservedByTeamName: null,
      },
    ];
    view.rerender(
      <TableManagement
        event={{ ...openEvent, assignedCount: 0, tableCount: 5 }}
        tables={refreshedTables}
      />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const refreshedInput = screen.getByLabelText("Desired table count");
    expect(refreshedInput).toHaveValue(5);
    expect(refreshedInput).toBeDisabled();

    await act(async () => {
      request.resolve({ ok: true, message: "Table count set to 2." });
      await request.promise;
    });
    expect(refreshMock).toHaveBeenCalledOnce();
    await waitFor(() => expect(refreshedInput).toBeEnabled());
    await waitFor(() => expect(refreshedInput).toHaveFocus());
  });

  it("keeps a pending reduction open, locked, and visible after failure", async () => {
    const request = deferred<{
      ok: false;
      error: string;
      fieldErrors: { count: string[] };
    }>();
    setReservationTableCountMock.mockReturnValue(request.promise);
    renderManager({
      event: { ...openEvent, assignedCount: 0 },
      eventTables: tables.map((table) => ({
        ...table,
        reservedByTeamId: null,
        reservedByTeamName: null,
      })),
    });

    const countInput = screen.getByLabelText("Desired table count");
    fireEvent.change(countInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm reduction" }),
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("New table number")).toBeDisabled();
    expect(
      tableCard(1).getByLabelText("New number for table 1"),
    ).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await act(async () => {
      request.resolve({
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: { count: ["Resolve the table assignments first."] },
      });
      await request.promise;
    });

    const failedDialog = screen.getByRole("alertdialog");
    expect(
      within(failedDialog).getByText("Check the highlighted fields."),
    ).toBeInTheDocument();
    expect(
      within(failedDialog).getByText("Resolve the table assignments first."),
    ).toBeInTheDocument();
    expect(countInput).toHaveValue(2);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("restores focus to the count control after closing a reduction", async () => {
    renderManager({
      event: { ...openEvent, assignedCount: 0 },
      eventTables: tables.map((table) => ({
        ...table,
        reservedByTeamId: null,
        reservedByTeamName: null,
      })),
    });
    const countInput = screen.getByLabelText("Desired table count");
    fireEvent.change(countInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    await waitFor(() => expect(countInput).toHaveFocus());
  });

  it("keeps reduction consequences inside its accessible description", () => {
    renderManager();
    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));

    const dialog = screen.getByRole("alertdialog");
    const descriptionId = dialog.getAttribute("aria-describedby");
    const description = descriptionId
      ? document.getElementById(descriptionId)
      : null;
    expect(description).toBeInstanceOf(HTMLElement);
    const describedContent = within(description as HTMLElement);
    expect(
      describedContent.getByText(
        "Assigned tables 3 (Alpha Team) and 7 (Beta Team) block this reduction.",
      ),
    ).toBeInTheDocument();
    expect(
      describedContent.getByText("This action cannot be undone."),
    ).toBeInTheDocument();
  });

  it("bounds long reduction target and blocker lists in a scroll area", () => {
    const manyTables = Array.from({ length: 30 }, (_, index) => ({
      id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
      number: index + 1,
      reservedByTeamId:
        index >= 25
          ? `${String(index + 101).padStart(8, "0")}-1111-4111-8111-111111111111`
          : null,
      reservedByTeamName: index >= 25 ? `Team ${index + 1}` : null,
    }));
    renderManager({
      event: {
        ...openEvent,
        tableCount: manyTables.length,
        assignedCount: 5,
      },
      eventTables: manyTables,
    });
    fireEvent.change(screen.getByLabelText("Desired table count"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reduction" }));

    const dialog = screen.getByRole("alertdialog");
    const scrollArea = within(dialog).getByRole("region", {
      name: "Reduction targets and blockers",
    });
    expect(scrollArea).toHaveAttribute("data-slot", "scroll-area");
    expect(scrollArea).toHaveClass("h-48");
    expect(within(scrollArea).getAllByRole("listitem")).toHaveLength(35);
    expect(
      within(dialog).getByRole("button", { name: "Confirm reduction" }),
    ).toBeInTheDocument();
  });

  it("validates a positive integer before adding a table", () => {
    renderManager();

    fireEvent.change(screen.getByLabelText("New table number"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add table" }));

    expect(
      screen.getByText("Enter a positive whole number."),
    ).toBeInTheDocument();
    expect(createReservationTableMock).not.toHaveBeenCalled();
  });

  it("keeps an add-table value and structured action errors visible", async () => {
    createReservationTableMock.mockResolvedValue({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: {
        number: ["That table number is unavailable."],
      },
    });
    renderManager();

    const input = screen.getByLabelText("New table number");
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add table" }));

    expect(
      await screen.findByText("Check the highlighted fields."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("That table number is unavailable."),
    ).toBeInTheDocument();
    expect(input).toHaveValue(12);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("toasts and refreshes after adding a table", async () => {
    createReservationTableMock.mockResolvedValue({
      ok: true,
      message: "Table 12 created.",
    });
    renderManager();
    const input = screen.getByLabelText("New table number");

    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add table" }));

    await waitFor(() => {
      expect(createReservationTableMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        number: 12,
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Table 12 created.");
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(input).toHaveValue(null);
  });

  it("validates a positive integer before renumbering a table", () => {
    renderManager();
    const card = tableCard(1);

    fireEvent.change(card.getByLabelText("New number for table 1"), {
      target: { value: "1.5" },
    });
    fireEvent.click(card.getByRole("button", { name: "Renumber table 1" }));

    expect(
      card.getByText("Enter a positive whole number."),
    ).toBeInTheDocument();
    expect(renumberReservationTableMock).not.toHaveBeenCalled();
  });

  it("confirms renumbering with old, new, and assigned-team context", () => {
    renderManager();
    const card = tableCard(3);

    fireEvent.change(card.getByLabelText("New number for table 3"), {
      target: { value: "8" },
    });
    fireEvent.click(card.getByRole("button", { name: "Renumber table 3" }));

    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", {
        name: "Renumber table 3 to 8?",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Alpha Team is assigned to table 3 and will remain assigned after it becomes table 8.",
      ),
    ).toBeInTheDocument();
    expect(renumberReservationTableMock).not.toHaveBeenCalled();
  });

  it("restores focus to the originating renumber control after cancel", async () => {
    renderManager();
    const card = tableCard(1);
    const renumberButton = card.getByRole("button", {
      name: "Renumber table 1",
    });
    fireEvent.change(card.getByLabelText("New number for table 1"), {
      target: { value: "8" },
    });
    renumberButton.focus();
    fireEvent.click(renumberButton);

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    await waitFor(() => expect(renumberButton).toHaveFocus());
    expect(renumberReservationTableMock).not.toHaveBeenCalled();
  });

  it("keeps a pending renumber open and retains structured failures", async () => {
    const request = deferred<{
      ok: false;
      error: string;
      fieldErrors: { number: string[] };
    }>();
    renumberReservationTableMock.mockReturnValue(request.promise);
    renderManager();
    const card = tableCard(1);
    const input = card.getByLabelText("New number for table 1");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.click(card.getByRole("button", { name: "Renumber table 1" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm renumber" }),
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Desired table count")).toBeDisabled();
    expect(
      tableCard(3).getByLabelText("New number for table 3"),
    ).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await act(async () => {
      request.resolve({
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: { number: ["That table number is already in use."] },
      });
      await request.promise;
    });

    const failedDialog = screen.getByRole("alertdialog");
    expect(
      within(failedDialog).getByText("Check the highlighted fields."),
    ).toBeInTheDocument();
    expect(
      within(failedDialog).getByText("That table number is already in use."),
    ).toBeInTheDocument();
    expect(input).toHaveValue(7);
    fireEvent.click(
      within(failedDialog).getByRole("button", { name: "Cancel" }),
    );
    expect(input).toHaveValue(7);
    expect(card.getByText("Check the highlighted fields.")).toBeInTheDocument();
    expect(
      card.getByText("That table number is already in use."),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("focuses the live refreshed control after a confirmed renumber", async () => {
    renumberReservationTableMock.mockResolvedValue({
      ok: true,
      message: "Table 1 renumbered to 8.",
    });
    const view = renderManager();
    const card = tableCard(1);
    const renumberButton = card.getByRole("button", {
      name: "Renumber table 1",
    });
    fireEvent.change(card.getByLabelText("New number for table 1"), {
      target: { value: "8" },
    });
    renumberButton.focus();
    fireEvent.click(renumberButton);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Confirm renumber",
      }),
    );

    await waitFor(() => {
      expect(renumberReservationTableMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        tableId: tables[0].id,
        number: 8,
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    await waitFor(() => expect(renumberButton).toHaveFocus());
    expect(toastSuccessMock).toHaveBeenCalledWith("Table 1 renumbered to 8.");
    expect(refreshMock).toHaveBeenCalledOnce();

    const refreshedTables = tables.map((table) =>
      table.id === tables[0].id ? { ...table, number: 8 } : table,
    );
    view.rerender(
      <TableManagement
        event={{
          ...openEvent,
          updatedAt: new Date("2026-08-21T12:00:00.000Z"),
        }}
        tables={refreshedTables}
      />,
    );

    const refreshedButton = tableCard(8).getByRole("button", {
      name: "Renumber table 8",
    });
    expect(document.body.contains(refreshedButton)).toBe(true);
    expect(document.activeElement).toBe(refreshedButton);
  });

  it("requires delete confirmation and replaces assigned deletes with a link", async () => {
    deleteReservationTableMock.mockResolvedValue({
      ok: true,
      message: "Table 1 deleted.",
    });
    renderManager();

    const openCard = tableCard(1);
    fireEvent.click(openCard.getByRole("button", { name: "Delete table 1" }));
    expect(deleteReservationTableMock).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete table" }),
    );
    await waitFor(() => {
      expect(deleteReservationTableMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        tableId: tables[0].id,
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Table 1 deleted.");
    expect(refreshMock).toHaveBeenCalledOnce();

    const assignedCard = tableCard(3);
    expect(assignedCard.getByText("Alpha Team")).toBeInTheDocument();
    expect(
      assignedCard.queryByRole("button", { name: "Delete table 3" }),
    ).not.toBeInTheDocument();
    expect(
      assignedCard.getByRole("link", { name: "Manage assignments" }),
    ).toHaveAttribute("href", `/admin/reservations/${EVENT_ID}/assignments`);
  });

  it("keeps a pending delete open and retains a structured failure", async () => {
    const request = deferred<{ ok: false; error: string }>();
    deleteReservationTableMock.mockReturnValue(request.promise);
    renderManager();
    fireEvent.click(
      tableCard(1).getByRole("button", { name: "Delete table 1" }),
    );
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete table" }),
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Desired table count")).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await act(async () => {
      request.resolve({
        ok: false,
        error: "Table 1 is assigned. Unassign the team first.",
      });
      await request.promise;
    });

    const failedDialog = screen.getByRole("alertdialog");
    expect(
      within(failedDialog).getByText(
        "Table 1 is assigned. Unassign the team first.",
      ),
    ).toBeInTheDocument();
    expect(
      within(failedDialog).getByRole("button", { name: "Cancel" }),
    ).toBeEnabled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders archived events as read-only", () => {
    renderManager({
      event: { ...openEvent, status: "archived" },
    });

    expect(
      screen.getByText(
        "Archived events are read-only. Restore the event before editing tables.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Desired table count")).toBeDisabled();
    expect(screen.getByLabelText("New table number")).toBeDisabled();
    expect(
      tableCard(1).getByLabelText("New number for table 1"),
    ).toBeDisabled();
    expect(
      tableCard(1).queryByRole("button", { name: "Delete table 1" }),
    ).not.toBeInTheDocument();
  });
});
