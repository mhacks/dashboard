// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ReservationAuditItem,
  ReservationAuditPage,
} from "@/lib/queries/admin-reservations";
import { AuditList } from "./audit-list";

const { navigationState, routerPushMock } = vi.hoisted(() => ({
  navigationState: { search: "" },
  routerPushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

const auditItem: ReservationAuditItem = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: "22222222-2222-4222-8222-222222222222",
  eventName: "Fall Showcase",
  actorUserId: "33333333-3333-4333-8333-333333333333",
  actorEmail: "organizer@example.com",
  action: "assignment.moved",
  entityType: "assignment",
  entityId: "44444444-4444-4444-8444-444444444444",
  details: {
    fromTableId: "table-1",
    toTableId: "table-2",
  },
  createdAt: new Date("2026-08-26T04:15:00.000Z"),
};

function renderList(
  page: ReservationAuditPage,
  basePath = "/admin/reservations/audit",
) {
  return render(<AuditList {...page} basePath={basePath} />);
}

describe("AuditList", () => {
  beforeEach(() => {
    navigationState.search = "";
    routerPushMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a truthful empty audit state without pagination", () => {
    renderList({
      items: [],
      pageIndex: 0,
      pageSize: 20,
      totalItems: 0,
    });

    expect(
      screen.getByText("0 immutable entries, newest first."),
    ).toBeInTheDocument();
    expect(screen.getByText("No audit activity found.")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "pagination" }),
    ).not.toBeInTheDocument();
  });

  it("renders actor, action, entity, timestamp, and collapsed details", () => {
    renderList({
      items: [auditItem],
      pageIndex: 0,
      pageSize: 20,
      totalItems: 1,
    });

    expect(screen.getByText("Team moved")).toBeInTheDocument();
    expect(
      screen.getByText("organizer@example.com · Fall Showcase"),
    ).toBeInTheDocument();
    expect(screen.getByText("Assignment")).toBeInTheDocument();
    expect(
      screen.getByText(`Entity ${auditItem.entityId}`),
    ).toBeInTheDocument();
    expect(screen.getByText(/Aug 26, 2026.*UTC/)).toBeInTheDocument();

    const details = screen.getByRole("button", { name: "Structured details" });
    expect(details).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(details);
    expect(details).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/"fromTableId": "table-1"/)).toBeVisible();
    expect(screen.getByText(/"toTableId": "table-2"/)).toBeVisible();
  });

  it("updates page in the URL while preserving existing filters", () => {
    navigationState.search = "actor=organizer%40example.com&page=1";
    renderList({
      items: [auditItem],
      pageIndex: 0,
      pageSize: 20,
      totalItems: 41,
    });

    fireEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(routerPushMock).toHaveBeenCalledWith(
      "/admin/reservations/audit?actor=organizer%40example.com&page=2",
    );
  });
});
