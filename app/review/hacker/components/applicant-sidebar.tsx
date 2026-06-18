"use client";

import * as React from "react";
import { type ApplicantData } from "../applicant-data";
import { type ReviewFormData } from "../review-criteria";
import { scoreAvg } from "./review-shell";

const STATUS_DOT: Record<ApplicantData["status"], string> = {
  reviewed: "#22C55E",
  flagged: "#EF4444",
  pending: "rgba(58,74,38,0.25)",
};

function ScoreChip({ score }: { score: string }) {
  const n = parseFloat(score);
  const color = n >= 4 ? "#166534" : n >= 3 ? "#92400E" : "#B91C1C";
  const bg = n >= 4 ? "#F0FDF4" : n >= 3 ? "#FEFCE8" : "#FEF2F2";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: 99,
        padding: "2px 7px",
        flexShrink: 0,
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
      {score}
    </span>
  );
}

interface SidebarProps {
  apps: ApplicantData[];
  reviews: Record<string, ReviewFormData>;
  selectedId: string;
  onSelect: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

type StatusFilter = "all" | "pending" | "reviewed" | "flagged";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "reviewed", label: "Reviewed" },
  { key: "flagged", label: "Flagged" },
];

export function Sidebar({
  apps,
  reviews,
  selectedId,
  onSelect,
  query,
  setQuery,
}: SidebarProps) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  const filtered = apps.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.university.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div
      style={{
        width: 272,
        borderRight: "1px solid rgba(58,74,38,0.12)",
        display: "flex",
        flexDirection: "column",
        background: "#f0efe6",
        flexShrink: 0,
      }}
    >
      {/* Search + filters */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(58,74,38,0.12)",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search applicants…"
          style={{
            width: "100%",
            height: 32,
            borderRadius: 8,
            border: "1.5px solid rgba(58,74,38,0.2)",
            padding: "0 10px",
            fontSize: 12,
            fontFamily: "var(--font-geist-sans), system-ui",
            color: "#3A4A26",
            background: "#fff",
            outline: "none",
          }}
        />
        {/* Status filter pills */}
        <div
          style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}
        >
          {FILTERS.map(({ key, label }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  fontFamily: "var(--font-geist-mono), monospace",
                  letterSpacing: "0.04em",
                  padding: "3px 9px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: active
                    ? "1.5px solid rgba(58,74,38,0.4)"
                    : "1.5px solid rgba(58,74,38,0.15)",
                  background: active ? "#3A4A26" : "transparent",
                  color: active ? "#fff" : "rgba(58,74,38,0.55)",
                  transition: "all 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
        {filtered.map((app) => {
          const avg = scoreAvg(reviews[app.id]);
          const sel = app.id === selectedId;
          return (
            <div
              key={app.id}
              onClick={() => onSelect(app.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 2,
                cursor: "pointer",
                background: sel ? "rgba(58,74,38,0.09)" : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!sel)
                  e.currentTarget.style.background = "rgba(58,74,38,0.05)";
              }}
              onMouseLeave={(e) => {
                if (!sel) e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 3,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: STATUS_DOT[app.status],
                      flexShrink: 0,
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: sel ? "#3A4A26" : "rgba(58,74,38,0.8)",
                      fontFamily: "var(--font-geist-sans), system-ui",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {app.name}
                  </span>
                </div>
                {avg && <ScoreChip score={avg} />}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(58,74,38,0.45)",
                  paddingLeft: 14,
                }}
              >
                {app.university}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(58,74,38,0.45)",
                  paddingLeft: 14,
                }}
              >
                {app.major} · {app.degree}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid rgba(58,74,38,0.12)",
          fontSize: 11,
          color: "rgba(58,74,38,0.45)",
          fontFamily: "var(--font-geist-mono), monospace",
          letterSpacing: "0.04em",
        }}
      >
        {apps.filter((a) => a.status === "reviewed").length} reviewed ·{" "}
        {apps.filter((a) => a.status === "flagged").length} flagged ·{" "}
        {apps.filter((a) => a.status === "pending").length} pending
      </div>
    </div>
  );
}
