"use client";

import * as React from "react";
import { format } from "date-fns";
import { type ApplicantData } from "../applicant-data";

interface ApplicationDetailProps {
  app: ApplicantData;
}

const PILL = {
  bg: "rgba(58,74,38,0.07)",
  color: "#3A4A26",
  border: "rgba(58,74,38,0.18)",
};

function Pill({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        background: PILL.bg,
        color: PILL.color,
        borderRadius: 99,
        padding: "2px 9px",
        border: `1px solid ${PILL.border}`,
        display: "inline-block",
        fontFamily: "var(--font-geist-sans), system-ui",
      }}
    >
      {text}
    </span>
  );
}

function LinkPill({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        fontSize: 11,
        color: "rgba(58,74,38,0.6)",
        textDecoration: "none",
        border: "1px solid rgba(58,74,38,0.18)",
        borderRadius: 99,
        padding: "2px 9px",
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontFamily: "var(--font-geist-sans), system-ui",
      }}
    >
      ↗ {children}
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.28em",
        color: "rgba(58,74,38,0.5)",
        textTransform: "uppercase",
        marginBottom: 10,
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
      ◆ {children}
    </div>
  );
}

const ESSAY_QUESTIONS: {
  label: string;
  key: keyof Pick<
    ApplicantData,
    "whatWouldYouDo" | "whyMhacks" | "hillToDieOn"
  >;
}[] = [
  { label: "What would you do?", key: "whatWouldYouDo" },
  { label: "Why MHacks?", key: "whyMhacks" },
  { label: "What's a hill you're willing to die on?", key: "hillToDieOn" },
];

export function ApplicationDetail({ app }: ApplicationDetailProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "28px 36px",
        background: "#fff",
      }}
    >
      {/* ── Applicant header ──────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 28,
                color: "#3A4A26",
                marginBottom: 4,
                lineHeight: 1.1,
              }}
            >
              {app.name}
            </h2>
            <div
              style={{
                fontSize: 13,
                color: "rgba(58,74,38,0.55)",
                fontFamily: "var(--font-geist-sans), system-ui",
              }}
            >
              {app.email}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(58,74,38,0.4)",
              flexShrink: 0,
              fontFamily: "var(--font-geist-mono), monospace",
              letterSpacing: "0.05em",
            }}
          >
            {format(new Date(app.date), "MMM d, yyyy")}
          </div>
        </div>

        {/* Pills */}
        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Pill text={app.university} />
          <Pill text={`Class of ${app.graduationYear}`} />
          <Pill text={app.major} />
          <Pill text={app.degree} />
          <Pill text={`${app.previousHackathons} hackathons`} />
          {app.github && <LinkPill href={app.github}>GitHub</LinkPill>}
          {app.linkedin && <LinkPill href={app.linkedin}>LinkedIn</LinkPill>}
          {app.personalSite && (
            <LinkPill href={app.personalSite}>Website</LinkPill>
          )}
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: "rgba(58,74,38,0.1)",
          marginBottom: 24,
        }}
      />

      {/* ── Essays ────────────────────────────────── */}
      {ESSAY_QUESTIONS.map(({ label, key }) => {
        const text = app[key];
        if (!text) return null;
        return (
          <div key={key} style={{ marginBottom: 26 }}>
            <SectionLabel>{label}</SectionLabel>
            <p
              style={{
                fontSize: 14,
                fontWeight: 300,
                lineHeight: 1.75,
                color: "rgba(58,74,38,0.8)",
                fontFamily: "var(--font-geist-sans), system-ui",
              }}
            >
              {text}
            </p>
          </div>
        );
      })}

      <div
        style={{
          height: 1,
          background: "rgba(58,74,38,0.1)",
          marginBottom: 24,
        }}
      />

      {/* ── Logistics ─────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Logistics</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "5px 0",
            fontSize: 12,
          }}
        >
          {[
            ["Coming from", app.comingFrom],
            ["Transportation", app.transportationType],
            ["Shirt size", app.shirtSize],
            [
              "Allergies",
              app.allergiesDescription || "None",
            ],
            [
              "Travel reimbursement",
              app.needsTravelReimbursement ? "Requested" : "Not needed",
            ],
            ["Country", app.country],
            ["Gender", app.gender],
            ["Ethnicity", app.ethnicity],
          ]
            .map(([label, value]) => [
              label,
              value ? value.charAt(0).toUpperCase() + value.slice(1) : value,
            ])
            .map(([label, value]) => (
              <React.Fragment key={label}>
                <span
                  style={{
                    color: "rgba(58,74,38,0.45)",
                    paddingRight: 16,
                    fontFamily: "var(--font-geist-mono), monospace",
                    letterSpacing: "0.03em",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color: "rgba(58,74,38,0.8)",
                    fontFamily: "var(--font-geist-sans), system-ui",
                  }}
                >
                  {value}
                </span>
              </React.Fragment>
            ))}
        </div>
      </div>
    </div>
  );
}
