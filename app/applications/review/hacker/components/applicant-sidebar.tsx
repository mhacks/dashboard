"use client"

import * as React from "react"
import { type ApplicantData } from "../applicant-data"
import { type ReviewFormData } from "../review-criteria"
import { scoreAvg } from "./review-shell"

const STATUS_DOT: Record<ApplicantData["status"], string> = {
  reviewed: "#22C55E",
  flagged: "#EF4444",
  pending: "#D1D5DB",
}

function ScoreChip({ score }: { score: string }) {
  const n = parseFloat(score)
  const color = n >= 4 ? "#166534" : n >= 3 ? "#92400E" : "#B91C1C"
  const bg    = n >= 4 ? "#F0FDF4" : n >= 3 ? "#FEFCE8" : "#FEF2F2"
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, background: bg,
      border: `1px solid ${color}33`, borderRadius: 99, padding: "2px 7px",
      flexShrink: 0,
    }}>
      {score}
    </span>
  )
}

interface SidebarProps {
  apps: ApplicantData[]
  reviews: Record<string, ReviewFormData>
  selectedId: string
  onSelect: (id: string) => void
  query: string
  setQuery: (q: string) => void
}

export function Sidebar({ apps, reviews, selectedId, onSelect, query, setQuery }: SidebarProps) {
  const filtered = apps.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.university.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div style={{
      width: 272, borderRight: "1px solid #F3F4F6", display: "flex",
      flexDirection: "column", background: "#FAFAFA", flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #F3F4F6" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search applicants…"
          style={{
            width: "100%", height: 32, borderRadius: 7, border: "1.5px solid #E2E8F0",
            padding: "0 10px", fontSize: 12, fontFamily: "inherit", color: "#374151",
            background: "#fff", outline: "none",
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
        {filtered.map((app) => {
          const avg = scoreAvg(reviews[app.id])
          const sel = app.id === selectedId
          return (
            <div
              key={app.id}
              onClick={() => onSelect(app.id)}
              style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer",
                background: sel ? "#EBF0FA" : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#F3F4F6" }}
              onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: STATUS_DOT[app.status],
                    flexShrink: 0, display: "inline-block",
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: sel ? "#1F51A6" : "#111",
                    fontFamily: '"Red Hat Display", system-ui, sans-serif',
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {app.name}
                  </span>
                </div>
                {avg && <ScoreChip score={avg} />}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", paddingLeft: 14 }}>{app.university}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", paddingLeft: 14 }}>
                {app.major} · {app.degree}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer stats */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #F3F4F6", fontSize: 11, color: "#9CA3AF" }}>
        {apps.filter((a) => a.status === "reviewed").length} reviewed ·{" "}
        {apps.filter((a) => a.status === "flagged").length} flagged ·{" "}
        {apps.filter((a) => a.status === "pending").length} pending
      </div>
    </div>
  )
}
