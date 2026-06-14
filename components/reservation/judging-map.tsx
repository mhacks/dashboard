"use client";

import { cn } from "@/lib/utils";
import { DEFAULT_COLUMNS, toRows } from "@/lib/reservation/layout";
import type { TableWithTeam } from "@/lib/db/queries/reservation";

export type TableStatus = "available" | "selected" | "mine" | "taken";

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

const seatStyles: Record<TableStatus, string> = {
  available:
    "border-zinc-300 bg-white text-zinc-600 hover:border-[#445721] hover:bg-[#445721]/5 hover:text-[#3A4A26]",
  selected:
    "border-[#445721] bg-[#445721] text-white shadow-sm ring-2 ring-[#445721]/30",
  mine: "border-[#445721]/50 bg-[#445721]/15 text-[#3A4A26] ring-1 ring-[#445721]/30",
  taken: "border-zinc-200 bg-zinc-100 text-zinc-300 cursor-not-allowed",
};

export function JudgingMap({
  tables,
  selectedTableId,
  teamId,
  onSelect,
  disabled = false,
}: {
  tables: TableWithTeam[];
  selectedTableId: string | null;
  teamId: string | null;
  onSelect: (table: TableWithTeam) => void;
  disabled?: boolean;
}) {
  const rows = toRows(tables, DEFAULT_COLUMNS);

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 sm:p-8">
        <div className="mx-auto w-fit min-w-full">
          <div className="mb-6 flex justify-center">
            <div className="rounded-md bg-[#3A4A26]/90 px-10 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-white sm:px-20">
              Judging Stage
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-2">
                {row.map((table) => {
                  const status = statusOf(table, selectedTableId, teamId);
                  const interactive =
                    !disabled &&
                    (status === "available" || status === "selected");

                  return (
                    <button
                      key={table.id}
                      type="button"
                      disabled={!interactive}
                      onClick={() => onSelect(table)}
                      title={
                        table.reservedByTeamName
                          ? `Table ${table.number} — ${table.reservedByTeamName}`
                          : `Table ${table.number} — available`
                      }
                      aria-label={`Table ${table.number}, ${status}`}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold transition-all sm:size-10 sm:text-xs",
                        seatStyles[status],
                        interactive
                          ? "cursor-pointer"
                          : status === "taken"
                            ? "cursor-not-allowed"
                            : "cursor-default",
                      )}
                    >
                      {table.number}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  const items: { label: string; className: string }[] = [
    { label: "Available", className: "border-zinc-300 bg-white" },
    { label: "Selected", className: "border-[#445721] bg-[#445721]" },
    {
      label: "Your table",
      className: "border-[#445721]/50 bg-[#445721]/15",
    },
    { label: "Reserved", className: "border-zinc-200 bg-zinc-100" },
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
