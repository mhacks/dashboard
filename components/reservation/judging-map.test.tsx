// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TableWithTeam } from "@/lib/reservation/types";
import { JudgingMap } from "./judging-map";

const TEAM_ALPHA_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_BRAVO_ID = "22222222-2222-4222-8222-222222222222";

const tables: TableWithTeam[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    number: 1,
    reservedByTeamId: null,
    reservedByTeamName: null,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    number: 2,
    reservedByTeamId: TEAM_BRAVO_ID,
    reservedByTeamName: "Team Bravo",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    number: 3,
    reservedByTeamId: TEAM_ALPHA_ID,
    reservedByTeamName: "Team Alpha",
  },
];

describe("JudgingMap", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps participant interactivity and labels as the default", () => {
    const onSelect = vi.fn();
    render(
      <JudgingMap
        tables={tables}
        selectedTableId={null}
        teamId={TEAM_ALPHA_ID}
        onSelect={onSelect}
      />,
    );

    const available = screen.getByRole("button", {
      name: "Table 1, available",
    });
    expect(available).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Table 2, taken" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Table 3, mine" }),
    ).toBeDisabled();
    expect(screen.getByText("Your table")).toBeInTheDocument();
    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.queryByText("Occupied")).not.toBeInTheDocument();

    fireEvent.click(available);
    expect(onSelect).toHaveBeenCalledWith(tables[0]);
  });

  it("enables occupied destinations only when admin mode is explicit", () => {
    const onSelect = vi.fn();
    render(
      <JudgingMap
        tables={tables}
        selectedTableId={null}
        teamId={TEAM_ALPHA_ID}
        onSelect={onSelect}
        mode="admin"
      />,
    );

    const occupied = screen.getByRole("button", {
      name: "Table 2, occupied by Team Bravo",
    });
    expect(
      screen.getByRole("button", { name: "Table 1, available" }),
    ).toBeEnabled();
    expect(occupied).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Table 3, selected team's table",
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Table 2, taken|Table 3, mine/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Selected team's table")).toBeInTheDocument();
    expect(screen.getByText("Occupied")).toBeInTheDocument();

    fireEvent.click(occupied);
    expect(onSelect).toHaveBeenCalledWith(tables[1]);
  });
});
