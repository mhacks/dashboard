// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReservationAuditPage as ReservationAuditPageData } from "@/lib/queries/admin-reservations";

const { getReservationAuditPageMock, redirectMock } = vi.hoisted(() => ({
  getReservationAuditPageMock: vi.fn(),
  redirectMock: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("@/lib/queries/admin-reservations", () => ({
  getReservationAuditPage: getReservationAuditPageMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import ReservationEventAuditPage from "../[eventId]/audit/page";
import ReservationAuditPage from "./page";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

function auditPage({
  pageIndex,
  totalItems,
  pageSize = 20,
}: {
  pageIndex: number;
  totalItems: number;
  pageSize?: number;
}): ReservationAuditPageData {
  return {
    items: [],
    pageIndex,
    pageSize,
    totalItems,
  };
}

const routes = [
  {
    label: "global audit",
    basePath: "/admin/reservations/audit",
    queryInput: (pageIndex: number) => ({ pageIndex }),
    render: (searchParams: Record<string, string | string[] | undefined>) =>
      ReservationAuditPage({
        searchParams: Promise.resolve(searchParams),
      }),
  },
  {
    label: "event audit",
    basePath: `/admin/reservations/${EVENT_ID}/audit`,
    queryInput: (pageIndex: number) => ({ eventId: EVENT_ID, pageIndex }),
    render: (searchParams: Record<string, string | string[] | undefined>) =>
      ReservationEventAuditPage({
        params: Promise.resolve({ eventId: EVENT_ID }),
        searchParams: Promise.resolve(searchParams),
      }),
  },
] as const;

describe.each(routes)("$label page normalization", (route) => {
  beforeEach(() => {
    getReservationAuditPageMock.mockReset();
    redirectMock.mockClear();
  });

  it("normalizes empty history to page 1 and preserves filters", async () => {
    getReservationAuditPageMock.mockResolvedValue(
      auditPage({ pageIndex: 998, totalItems: 0 }),
    );

    await expect(
      route.render({ page: "999", actor: "organizer@example.com" }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:${route.basePath}?actor=organizer%40example.com&page=1`,
    );

    expect(getReservationAuditPageMock).toHaveBeenCalledWith(
      route.queryInput(998),
    );
  });

  it("keeps the exact last page without redirecting", async () => {
    getReservationAuditPageMock.mockResolvedValue(
      auditPage({ pageIndex: 1, totalItems: 40 }),
    );

    await expect(route.render({ page: "2" })).resolves.toBeTruthy();

    expect(getReservationAuditPageMock).toHaveBeenCalledWith(
      route.queryInput(1),
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects an out-of-range page to the last page with context", async () => {
    getReservationAuditPageMock.mockResolvedValue(
      auditPage({ pageIndex: 6, totalItems: 40 }),
    );

    await expect(
      route.render({ page: "7", entity: ["table", "assignment"] }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:${route.basePath}?entity=table&entity=assignment&page=2`,
    );

    expect(getReservationAuditPageMock).toHaveBeenCalledWith(
      route.queryInput(6),
    );
  });
});
