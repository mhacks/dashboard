// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
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
import type {
  AdminReservationEventDetail,
  AdminReservationEventListItem,
} from "@/lib/queries/admin-reservations";
import { EventOverview } from "./[eventId]/event-overview";
import ReservationEventLayout from "./[eventId]/layout";
import { ReservationEventNav } from "./[eventId]/reservation-event-nav";
import { ReservationEventForm } from "./reservation-event-form";
import * as ReservationEventListModule from "./reservation-event-list";

const { ReservationEventList } = ReservationEventListModule;

const {
  archiveReservationEventMock,
  createReservationEventMock,
  deleteReservationEventMock,
  getAdminReservationEventMock,
  navigationState,
  notFoundMock,
  pushMock,
  refreshMock,
  restoreReservationEventMock,
  toastSuccessMock,
  updateReservationEventMock,
} = vi.hoisted(() => ({
  archiveReservationEventMock: vi.fn(),
  createReservationEventMock: vi.fn(),
  deleteReservationEventMock: vi.fn(),
  getAdminReservationEventMock: vi.fn(),
  navigationState: { pathname: "" },
  notFoundMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  restoreReservationEventMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  updateReservationEventMock: vi.fn(),
}));

vi.mock("@/lib/actions/admin-reservations.server.actions", () => ({
  archiveReservationEvent: archiveReservationEventMock,
  createReservationEvent: createReservationEventMock,
  deleteReservationEvent: deleteReservationEventMock,
  restoreReservationEvent: restoreReservationEventMock,
  updateReservationEvent: updateReservationEventMock,
}));

vi.mock("@/lib/queries/admin-reservations", () => ({
  getAdminReservationEvent: getAdminReservationEventMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  usePathname: () => navigationState.pathname,
  useRouter: () => ({
    push: pushMock,
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

vi.mock("@/app/admin/components/admin-header-actions", () => ({
  AdminHeaderActions: () => null,
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const INITIAL_TIMEZONE = process.env.TZ;

const scheduledEvent: AdminReservationEventListItem = {
  id: EVENT_ID,
  name: "Fall Showcase",
  status: "open",
  startsAt: new Date("2026-09-12T17:00:00.000Z"),
  reservationsOpenAt: new Date("2026-09-01T16:00:00.000Z"),
  reservationsCloseAt: new Date("2026-09-10T16:00:00.000Z"),
  tableCount: 12,
  assignedCount: 7,
  reservationAvailability: {
    state: "scheduled",
    canReserve: false,
    boundary: new Date("2026-09-01T16:00:00.000Z"),
  },
};

function eventDetail(
  overrides: Partial<AdminReservationEventDetail> = {},
): AdminReservationEventDetail {
  return {
    ...scheduledEvent,
    description: "Participant-facing event details.",
    location: "Michigan Union",
    createdAt: new Date("2026-08-01T16:00:00.000Z"),
    updatedAt: new Date("2026-08-02T16:00:00.000Z"),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function openCreateDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Create event" }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  archiveReservationEventMock.mockReset();
  createReservationEventMock.mockReset();
  deleteReservationEventMock.mockReset();
  getAdminReservationEventMock.mockReset();
  navigationState.pathname = `/admin/reservations/${EVENT_ID}`;
  notFoundMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  restoreReservationEventMock.mockReset();
  toastSuccessMock.mockReset();
  updateReservationEventMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ReservationEventList", () => {
  it("renders lifecycle, schedule, table, and assignment summaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));
    try {
      render(<ReservationEventList initialEvents={[scheduledEvent]} />);

      const startsAt = ReservationEventListModule.formatReservationDateTime(
        scheduledEvent.startsAt,
      );
      const opensAt = ReservationEventListModule.formatReservationDateTime(
        scheduledEvent.reservationsOpenAt,
      );

      expect(
        screen.getByRole("link", { name: "Fall Showcase" }),
      ).toHaveAttribute("href", `/admin/reservations/${EVENT_ID}`);
      expect(screen.getByText("Open")).toHaveAttribute(
        "data-variant",
        "default",
      );
      expect(screen.getByText("Scheduled")).toHaveAttribute(
        "data-variant",
        "outline",
      );
      expect(screen.getByText("Starts")).toBeInTheDocument();
      expect(screen.getByText(startsAt!)).toBeInTheDocument();
      expect(screen.getByText("Reservation window")).toBeInTheDocument();
      expect(screen.getByText(`Opens ${opensAt}`)).toBeInTheDocument();
      expect(screen.getByText("12 tables")).toBeInTheDocument();
      expect(screen.getByText("7 assigned")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps event start metadata separate from an open reservation window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    try {
      render(
        <ReservationEventList
          initialEvents={[
            {
              ...scheduledEvent,
              reservationAvailability: { state: "open", canReserve: true },
            },
          ]}
        />,
      );

      expect(screen.getAllByText("Open")).toHaveLength(2);
      expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
      expect(
        screen.getByText(
          `Closes ${ReservationEventListModule.formatReservationDateTime(
            scheduledEvent.reservationsCloseAt,
          )}`,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Starts")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("labels an expired open event as closed by its window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    try {
      render(
        <ReservationEventList
          initialEvents={[
            {
              ...scheduledEvent,
              reservationAvailability: { state: "closed", canReserve: false },
            },
          ]}
        />,
      );

      expect(screen.getByText("Closed by window")).toHaveAttribute(
        "data-variant",
        "secondary",
      );
      expect(
        screen.getByText(
          `Closed ${ReservationEventListModule.formatReservationDateTime(
            scheduledEvent.reservationsCloseAt,
          )}`,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hydrates local schedule summaries without server timezone markup", async () => {
    const previousTz = process.env.TZ;
    const container = document.createElement("div");
    const recoverableErrors: unknown[] = [];
    let root: Root | undefined;
    document.body.append(container);

    try {
      process.env.TZ = "UTC";
      container.innerHTML = renderToString(
        <ReservationEventList initialEvents={[scheduledEvent]} />,
      );

      expect(container).toHaveTextContent("Loading local time…");
      expect(container).toHaveTextContent("Loading local times…");
      expect(container).not.toHaveTextContent("Sep 12, 2026, 5:00 PM");

      process.env.TZ = "America/Los_Angeles";
      await act(async () => {
        root = hydrateRoot(
          container,
          <ReservationEventList initialEvents={[scheduledEvent]} />,
          {
            onRecoverableError: (error) => recoverableErrors.push(error),
          },
        );
      });

      await waitFor(() => {
        expect(container).toHaveTextContent("Sep 12, 2026, 10:00 AM");
        expect(container).toHaveTextContent("Opens Sep 1, 2026, 9:00 AM");
      });
      expect(recoverableErrors).toEqual([]);
    } finally {
      if (root) {
        await act(async () => root?.unmount());
      }
      container.remove();
      if (previousTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTz;
      }
    }
  });

  it("formats the same instant deterministically in explicit timezones", () => {
    const formatReservationDateTime = (
      ReservationEventListModule as unknown as {
        formatReservationDateTime?: (
          value: Date | string | null,
          timeZone?: string,
        ) => string | null;
      }
    ).formatReservationDateTime;

    expect(formatReservationDateTime).toBeTypeOf("function");
    expect(formatReservationDateTime?.(scheduledEvent.startsAt, "UTC")).toBe(
      "Sep 12, 2026, 5:00 PM",
    );
    expect(
      formatReservationDateTime?.(
        scheduledEvent.startsAt,
        "America/Los_Angeles",
      ),
    ).toBe("Sep 12, 2026, 10:00 AM");
  });

  it("hydrates edit inputs with browser-local values only", async () => {
    const previousTz = process.env.TZ;
    const container = document.createElement("div");
    const recoverableErrors: unknown[] = [];
    let root: Root | undefined;
    document.body.append(container);

    try {
      process.env.TZ = "UTC";
      container.innerHTML = renderToString(
        <ReservationEventForm event={eventDetail()} />,
      );

      expect(container).toHaveTextContent("Preparing local event times…");
      expect(container.querySelector('input[name="startsAt"]')).toBeNull();

      process.env.TZ = "America/Los_Angeles";
      await act(async () => {
        root = hydrateRoot(
          container,
          <ReservationEventForm event={eventDetail()} />,
          {
            onRecoverableError: (error) => recoverableErrors.push(error),
          },
        );
      });

      await waitFor(() => {
        expect(within(container).getByLabelText("Start time")).toHaveValue(
          "2026-09-12T10:00",
        );
        expect(
          within(container).getByLabelText("Reservations open"),
        ).toHaveValue("2026-09-01T09:00");
        expect(
          within(container).getByLabelText("Reservations close"),
        ).toHaveValue("2026-09-10T09:00");
      });
      expect(recoverableErrors).toEqual([]);
    } finally {
      if (root) {
        await act(async () => root?.unmount());
      }
      container.remove();
      if (previousTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTz;
      }
    }
  });

  it("restores the inherited timezone after hydration checks", () => {
    expect(process.env.TZ).toBe(INITIAL_TIMEZONE);
  });

  it("offers event creation from the empty state", () => {
    render(<ReservationEventList initialEvents={[]} />);

    expect(screen.getByText("No reservation events yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create event" })).toBeEnabled();
  });

  it("exposes every event and reservation-window field", () => {
    render(<ReservationEventList initialEvents={[]} />);

    openCreateDialog();

    expect(screen.getByLabelText("Event name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Reservations open")).toBeInTheDocument();
    expect(screen.getByLabelText("Reservations close")).toBeInTheDocument();
  });

  it("closes and refreshes after a successful create", async () => {
    createReservationEventMock.mockResolvedValue({
      ok: true,
      message: "Event created.",
      data: { eventId: EVENT_ID },
    });
    render(<ReservationEventList initialEvents={[]} />);

    const dialog = openCreateDialog();
    fireEvent.change(within(dialog).getByLabelText("Event name"), {
      target: { value: "Demo Day" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create event" }),
    );

    await waitFor(() => {
      expect(createReservationEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Demo Day",
          status: "draft",
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Event created.");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("locks the create dialog and submission while the request is in flight", async () => {
    const request = deferred<{
      ok: false;
      error: string;
      fieldErrors: { name: string[] };
    }>();
    createReservationEventMock.mockReturnValue(request.promise);
    render(<ReservationEventList initialEvents={[]} />);

    const dialog = openCreateDialog();
    const nameInput = within(dialog).getByLabelText("Event name");
    const submitButton = within(dialog).getByRole("button", {
      name: "Create event",
    });
    fireEvent.change(nameInput, { target: { value: "Delayed Demo" } });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-slot="dialog-trigger"]',
    );
    const closeButton = within(dialog).queryByRole("button", { name: "Close" });
    const triggerWasDisabled = trigger?.disabled;
    const closeWasHidden = closeButton === null;

    fireEvent.submit(submitButton.closest("form")!);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);

    await act(async () => {
      request.resolve({
        ok: false,
        error: "Creation is temporarily blocked.",
        fieldErrors: {
          name: ["Keep this event name."],
        },
      });
      await request.promise;
    });

    expect(createReservationEventMock).toHaveBeenCalledOnce();
    expect(triggerWasDisabled).toBe(true);
    expect(closeWasHidden).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Creation is temporarily blocked."),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep this event name.")).toBeInTheDocument();
    expect(nameInput).toHaveValue("Delayed Demo");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("serializes local schedule values as absolute instants", async () => {
    const previousTz = process.env.TZ;

    try {
      process.env.TZ = "America/Los_Angeles";
      expect(new Date("2026-09-12T13:30").getTimezoneOffset()).toBe(420);
      createReservationEventMock.mockResolvedValue({
        ok: true,
        message: "Event created.",
        data: { eventId: EVENT_ID },
      });
      render(<ReservationEventList initialEvents={[]} />);

      const dialog = openCreateDialog();
      fireEvent.change(within(dialog).getByLabelText("Event name"), {
        target: { value: "Demo Day" },
      });
      fireEvent.change(within(dialog).getByLabelText("Start time"), {
        target: { value: "2026-09-12T13:30" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Create event" }),
      );

      await waitFor(() => {
        expect(createReservationEventMock).toHaveBeenCalledWith(
          expect.objectContaining({
            startsAt: "2026-09-12T20:30:00.000Z",
          }),
        );
      });
    } finally {
      if (previousTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTz;
      }
    }
  });

  it("keeps API errors and entered values visible", async () => {
    createReservationEventMock.mockResolvedValue({
      ok: false,
      error: "The event could not be created.",
      fieldErrors: {
        name: ["An event with this name already exists."],
      },
    });
    render(<ReservationEventList initialEvents={[]} />);

    const dialog = openCreateDialog();
    const nameInput = within(dialog).getByLabelText("Event name");
    fireEvent.change(nameInput, { target: { value: "Demo Day" } });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create event" }),
    );

    expect(
      await screen.findByText("The event could not be created."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("An event with this name already exists."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(nameInput).toHaveValue("Demo Day");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the event's exact lifecycle status in the overview", () => {
    render(
      <EventOverview
        event={{
          ...scheduledEvent,
          status: "closed",
          description: null,
          location: null,
          createdAt: new Date("2026-08-01T16:00:00.000Z"),
          updatedAt: new Date("2026-08-02T16:00:00.000Z"),
        }}
      />,
    );

    const lifecycleCard = screen
      .getByText("Lifecycle")
      .closest('[data-slot="card"]');
    expect(lifecycleCard).not.toBeNull();
    expect(
      within(lifecycleCard as HTMLElement).getByText("Closed"),
    ).toBeInTheDocument();
  });
});

describe("reservation event workspace", () => {
  it("renders exact route-backed navigation and active state", () => {
    navigationState.pathname = `/admin/reservations/${EVENT_ID}/assignments`;

    render(<ReservationEventNav eventId={EVENT_ID} />);

    const expectedLinks = [
      ["Overview", `/admin/reservations/${EVENT_ID}`],
      ["Tables", `/admin/reservations/${EVENT_ID}/tables`],
      ["Assignments", `/admin/reservations/${EVENT_ID}/assignments`],
      ["Audit", `/admin/reservations/${EVENT_ID}/audit`],
    ] as const;

    for (const [name, href] of expectedLinks) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders the exact participant preview URL from the workspace layout", async () => {
    getAdminReservationEventMock.mockResolvedValue(eventDetail());

    const layout = await ReservationEventLayout({
      children: <div>Overview content</div>,
      params: Promise.resolve({ eventId: EVENT_ID }),
    });
    render(layout);

    expect(getAdminReservationEventMock).toHaveBeenCalledWith(EVENT_ID);
    expect(
      screen.getByRole("link", { name: "Preview participant view" }),
    ).toHaveAttribute("href", `/admin/reservations/${EVENT_ID}/preview`);
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });
});

describe("EventOverview", () => {
  it("submits edited values and refreshes after success", async () => {
    updateReservationEventMock.mockResolvedValue({
      ok: true,
      message: "Event updated.",
    });
    render(<EventOverview event={eventDetail()} />);

    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Updated Showcase" },
    });
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "2026-09-12T12:15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateReservationEventMock).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        values: expect.objectContaining({
          name: "Updated Showcase",
          startsAt: new Date("2026-09-12T12:15").toISOString(),
          status: "open",
        }),
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Event updated.");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("disables normal editing and retains restore/delete for archived events", () => {
    render(
      <EventOverview
        event={eventDetail({
          status: "archived",
        })}
      />,
    );

    expect(
      screen.getByText(/Archived events are read-only/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Event name")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByLabelText("Location")).toBeDisabled();
    expect(screen.getByLabelText("Start time")).toBeDisabled();
    expect(screen.getByLabelText("Status")).toBeDisabled();
    expect(screen.getByLabelText("Reservations open")).toBeDisabled();
    expect(screen.getByLabelText("Reservations close")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Archive event" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore event" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete event" })).toBeEnabled();
  });

  it("keeps an archive backend error open without discarding edit values", async () => {
    archiveReservationEventMock.mockResolvedValue({
      ok: false,
      error: "Archive is temporarily blocked.",
    });
    render(<EventOverview event={eventDetail()} />);

    const nameInput = screen.getByLabelText("Event name");
    fireEvent.change(nameInput, { target: { value: "Unsaved Showcase" } });
    fireEvent.click(screen.getByRole("button", { name: "Archive event" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Archive this event?")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Archive event" }),
    );

    expect(
      await within(dialog).findByText("Archive is temporarily blocked."),
    ).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(nameInput).toHaveValue("Unsaved Showcase");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("archives after confirmation and refreshes", async () => {
    archiveReservationEventMock.mockResolvedValue({
      ok: true,
      message: "Event archived.",
    });
    render(<EventOverview event={eventDetail()} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive event" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Archive this event?")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Archive event" }),
    );

    await waitFor(() => {
      expect(archiveReservationEventMock).toHaveBeenCalledWith(EVENT_ID);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Event archived.");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("restores an archived event after confirmation and refreshes", async () => {
    restoreReservationEventMock.mockResolvedValue({
      ok: true,
      message: "Event restored to closed.",
    });
    render(
      <EventOverview
        event={eventDetail({
          status: "archived",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore event" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Restore this event?")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Restore event" }),
    );

    await waitFor(() => {
      expect(restoreReservationEventMock).toHaveBeenCalledWith(EVENT_ID);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Event restored to closed.");
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("deletes after confirmation and returns to the event list", async () => {
    deleteReservationEventMock.mockResolvedValue({
      ok: true,
      message: "Event deleted.",
    });
    render(<EventOverview event={eventDetail({ assignedCount: 0 })} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Permanently delete this event?"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete event" }),
    );

    await waitFor(() => {
      expect(deleteReservationEventMock).toHaveBeenCalledWith(EVENT_ID);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Event deleted.");
    expect(pushMock).toHaveBeenCalledWith("/admin/reservations");
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
