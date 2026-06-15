"use client"

import * as React from "react"
import { format } from "date-fns"
import { type Mail } from "../data"

interface ApplicationDetailProps {
  app: Mail
}

const PILL_BLUE   = { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE33" }
const PILL_GREEN  = { bg: "#F0FDF4", color: "#166534", border: "#BBF7D033" }
const PILL_ORANGE = { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA33" }
const PILL_GRAY   = { bg: "#F9FAFB", color: "#374151", border: "#E5E7EB" }

function Pill({ text, style = PILL_BLUE }: { text: string; style?: typeof PILL_BLUE }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, background: style.bg, color: style.color,
      borderRadius: 99, padding: "2px 8px", border: `1px solid ${style.border}`,
      display: "inline-block",
    }}>
      {text}
    </span>
  )
}

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      fontSize: 11, color: "#6B7280", textDecoration: "none",
      border: "1px solid #E5E7EB", borderRadius: 99, padding: "2px 8px",
      display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      ↗ {children}
    </a>
  )
}

const ESSAY_QUESTIONS: { label: string; key: keyof Pick<Mail, "whyAttend" | "technicalChallenge" | "proudProject" | "anythingElse"> }[] = [
  { label: "Why do you want to attend MHacks?", key: "whyAttend" },
  { label: "Describe a project you have built.", key: "proudProject" },
  { label: "Describe a technical challenge you overcame.", key: "technicalChallenge" },
]

export function ApplicationDetail({ app }: ApplicationDetailProps) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", background: "#fff" }}>
      {/* ── Applicant header ──────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <h2 style={{
              fontFamily: '"Red Hat Display", system-ui, sans-serif',
              fontWeight: 700, fontSize: 22, color: "#111", marginBottom: 4,
            }}>
              {app.name}
            </h2>
            <div style={{ fontSize: 13, color: "#6B7280" }}>{app.email}</div>
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>
            Submitted {format(new Date(app.date), "MMM d, yyyy")}
          </div>
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Pill text={app.university} />
          <Pill text={`Class of ${app.graduationYear}`} style={PILL_GREEN} />
          <Pill text={app.major} style={PILL_ORANGE} />
          <Pill text={app.degree} style={PILL_GRAY} />
          <Pill text={`${app.previousHackathons} hackathons`} style={PILL_GRAY} />
          {app.github && <LinkPill href={app.github}>GitHub</LinkPill>}
          {app.linkedin && <LinkPill href={app.linkedin}>LinkedIn</LinkPill>}
          {app.personalSite && <LinkPill href={app.personalSite}>Website</LinkPill>}
        </div>
      </div>

      <div style={{ height: 1, background: "#F3F4F6", marginBottom: 20 }} />

      {/* ── Essays ────────────────────────────────── */}
      {ESSAY_QUESTIONS.map(({ label, key }) => {
        const text = app[key]
        if (!text) return null
        return (
          <div key={key} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
              color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8,
            }}>
              {label}
            </div>
            <p style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.7, color: "#374151" }}>
              {text}
            </p>
          </div>
        )
      })}

      {app.anythingElse && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
            color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8,
          }}>
            Anything else?
          </div>
          <p style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.7, color: "#374151" }}>
            {app.anythingElse}
          </p>
        </div>
      )}

      <div style={{ height: 1, background: "#F3F4F6", marginBottom: 20 }} />

      {/* ── Logistics ─────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
          color: "#9CA3AF", textTransform: "uppercase", marginBottom: 10,
        }}>
          Logistics
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 0", fontSize: 12 }}>
          {[
            ["Coming from", app.comingFrom],
            ["Transportation", app.transportationType],
            ["Shirt size", app.shirtSize],
            ["Allergies", app.hasAllergies ? (app.allergiesDescription ?? "Yes") : "None"],
            ["Travel reimbursement", app.needsTravelReimbursement ? "Requested" : "Not needed"],
            ["Country", app.country],
            ["Gender", app.gender],
            ["Ethnicity", app.ethnicity],
          ].map(([label, value]) => (
            <React.Fragment key={label}>
              <span style={{ color: "#9CA3AF", paddingRight: 16 }}>{label}</span>
              <span style={{ color: "#374151" }}>{value}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
