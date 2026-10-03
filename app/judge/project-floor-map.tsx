"use client";

import { MapViewport } from "@/components/map-viewport";
import { cn } from "@/lib/utils";
import {
  fitsReservationMap,
  reservationGridExtent,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";

export type FloorHighlight =
  | { mode: "floor" }
  | { mode: "pair"; left: number | null; right: number | null }
  | { mode: "track"; tableNumbers: number[] };

type SeatKind = "open" | "taken" | "left" | "right" | "track" | "quiet";

function seatKind(table: TableWithTeam, highlight: FloorHighlight): SeatKind {
  if (highlight.mode === "pair") {
    if (highlight.left != null && table.number === highlight.left)
      return "left";
    if (highlight.right != null && table.number === highlight.right) {
      return "right";
    }
    return "quiet";
  }
  if (highlight.mode === "track") {
    if (highlight.tableNumbers.includes(table.number)) return "track";
  }
  return table.reservedByTeamId ? "taken" : "open";
}

const seatStyles: Record<SeatKind, string> = {
  open: "border-zinc-300 bg-white text-zinc-600",
  taken: "border-zinc-200 bg-zinc-100 text-zinc-400",
  quiet: "border-zinc-200 bg-zinc-100 text-zinc-300",
  left: "border-[#445721] bg-[#445721] text-white ring-2 ring-[#445721]/30",
  right: "border-[#9a3412] bg-[#9a3412] text-white ring-2 ring-[#9a3412]/30",
  track: "border-[#1d4e89] bg-[#1d4e89] text-white ring-2 ring-[#1d4e89]/30",
};

function legendFor(
  highlight: FloorHighlight,
): { label: string; className: string }[] {
  if (highlight.mode === "pair") {
    return [
      { label: "Project A", className: "border-[#445721] bg-[#445721]" },
      { label: "Project B", className: "border-[#9a3412] bg-[#9a3412]" },
      { label: "Other tables", className: "border-zinc-200 bg-zinc-100" },
    ];
  }
  if (highlight.mode === "track") {
    return [
      { label: "This track", className: "border-[#1d4e89] bg-[#1d4e89]" },
      { label: "Reserved", className: "border-zinc-200 bg-zinc-100" },
      { label: "Open", className: "border-zinc-300 bg-white" },
    ];
  }
  return [
    { label: "Open", className: "border-zinc-300 bg-white" },
    { label: "Reserved", className: "border-zinc-200 bg-zinc-100" },
  ];
}

export function ProjectFloorMap({
  tables,
  columns,
  rows,
  highlight,
}: {
  tables: TableWithTeam[];
  columns: number;
  rows: number;
  highlight: FloorHighlight;
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
              const kind = seatKind(table, highlight);
              const label =
                kind === "left"
                  ? `Table ${table.number}, project A`
                  : kind === "right"
                    ? `Table ${table.number}, project B`
                    : kind === "track"
                      ? `Table ${table.number}, in the selected track`
                      : `Table ${table.number}`;
              return (
                <div
                  key={table.id}
                  data-floor-table=""
                  title={
                    table.reservedByTeamName
                      ? `Table ${table.number} — ${table.reservedByTeamName}`
                      : `Table ${table.number}`
                  }
                  aria-label={label}
                  style={{
                    gridColumn: `${table.originX + 1} / span ${table.width}`,
                    gridRow: `${table.originY + 1} / span ${table.height}`,
                  }}
                  className={cn(
                    "z-10 flex h-full w-full items-center justify-center rounded-md border text-[11px] font-semibold sm:text-xs",
                    seatStyles[kind],
                  )}
                >
                  {table.number}
                </div>
              );
            })}
          </div>
        </div>
      </MapViewport>
      <p className="text-xs text-zinc-500">
        Scroll or pinch to zoom. Drag empty space to look around. Table
        positions are the ones hackers reserved.
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
        {legendFor(highlight).map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className={cn("size-4 rounded border", item.className)}
              aria-hidden
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
