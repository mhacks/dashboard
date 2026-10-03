"use client";

import { MapViewport } from "@/components/map-viewport";
import { cn } from "@/lib/utils";
import {
  fitsReservationMap,
  reservationGridExtent,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";

export type TableStatus = "available" | "selected" | "mine" | "taken";
export type JudgingMapMode = "participant" | "admin";

function statusOf(
  table: TableWithTeam,
  selectedTableId: string | null,
  teamId: string | null,
): TableStatus {
  if (table.id === selectedTableId) return "selected";
  if (table.reservedByTeamId) {
    return teamId && table.reservedByTeamId === teamId ? "mine" : "taken";
  }
  return "available";
}

function tableAriaLabel(
  table: TableWithTeam,
  status: TableStatus,
  mode: JudgingMapMode,
): string {
  if (mode === "admin") {
    if (status === "mine") {
      return `Table ${table.number}, selected team's table`;
    }
    if (status === "taken") {
      return `Table ${table.number}, occupied by ${
        table.reservedByTeamName ?? "unknown team"
      }`;
    }
  }
  return `Table ${table.number}, ${status}`;
}

const seatStyles: Record<TableStatus, string> = {
  available:
    "border-zinc-300 bg-white text-zinc-600 hover:border-[#445721] hover:bg-[#445721]/5 hover:text-[#3A4A26]",
  selected:
    "border-[#445721] bg-[#445721] text-white shadow-sm ring-2 ring-[#445721]/30",
  mine: "border-[#445721]/50 bg-[#445721]/15 text-[#3A4A26] ring-1 ring-[#445721]/30",
  taken: "border-zinc-200 bg-zinc-100 text-zinc-300",
};

export function JudgingMap({
  tables,
  columns,
  rows,
  selectedTableId,
  teamId,
  onSelect,
  disabled = false,
  mode = "participant",
}: {
  tables: TableWithTeam[];
  columns: number;
  rows: number;
  selectedTableId: string | null;
  teamId: string | null;
  onSelect?: (table: TableWithTeam) => void;
  disabled?: boolean;
  mode?: JudgingMapMode;
}) {
  const placed = tables.filter(fitsReservationMap);
  const extent = reservationGridExtent(placed, columns, rows);
  const cellCount = extent.columns * extent.rows;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <MapViewport
        columns={extent.columns}
        rows={extent.rows}
        fitColumns={columns}
        fitRows={rows}
      >
        <div className="w-fit">
          <div
            className="grid"
            style={{
              gap: "var(--map-gap)",
              gridTemplateColumns: `repeat(${extent.columns}, var(--cell))`,
              gridTemplateRows: `repeat(${extent.rows}, var(--cell))`,
            }}
          >
            {Array.from({ length: cellCount }, (_, index) => (
              <span
                key={`cell-${index}`}
                aria-hidden
                className="pointer-events-none flex items-center justify-center"
                style={{
                  gridColumn: (index % extent.columns) + 1,
                  gridRow: Math.floor(index / extent.columns) + 1,
                }}
              >
                <span className="size-[12%] rounded-full bg-zinc-400/25" />
              </span>
            ))}
            {placed.map((table) => {
              const status = statusOf(table, selectedTableId, teamId);
              const interactive =
                !disabled &&
                (mode === "admin"
                  ? status !== "mine"
                  : status === "available" || status === "selected");

              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={!interactive}
                  onClick={onSelect ? () => onSelect(table) : undefined}
                  title={
                    table.reservedByTeamName
                      ? `Table ${table.number} — ${table.reservedByTeamName}`
                      : `Table ${table.number} — available`
                  }
                  aria-label={tableAriaLabel(table, status, mode)}
                  style={{
                    gridColumn: `${table.originX + 1} / span ${table.width}`,
                    gridRow: `${table.originY + 1} / span ${table.height}`,
                  }}
                  className={cn(
                    "z-10 flex h-full w-full items-center justify-center rounded-md border text-[11px] font-semibold transition-colors sm:text-xs",
                    seatStyles[status],
                    interactive ? "cursor-pointer" : "cursor-not-allowed",
                  )}
                >
                  {table.number}
                </button>
              );
            })}
          </div>
        </div>
      </MapViewport>

      <p className="text-xs text-zinc-500">
        Scroll or pinch to zoom. Drag empty space to look around.
      </p>
      <Legend mode={mode} />
    </div>
  );
}

function Legend({ mode }: { mode: JudgingMapMode }) {
  const items: { label: string; className: string }[] = [
    { label: "Available", className: "border-zinc-300 bg-white" },
    {
      label: mode === "admin" ? "Selected destination" : "Selected",
      className: "border-[#445721] bg-[#445721]",
    },
    {
      label: mode === "admin" ? "Selected team's table" : "Your table",
      className: "border-[#445721]/50 bg-[#445721]/15",
    },
    {
      label: mode === "admin" ? "Occupied" : "Reserved",
      className: "border-zinc-200 bg-zinc-100",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className={cn("size-4 rounded border", item.className)}
            aria-hidden
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
