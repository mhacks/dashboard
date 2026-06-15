"use client";

import * as React from "react";
import { type ApplicantData } from "../applicant-data";
import { type ReviewFormData } from "../review-criteria";
import { Sidebar } from "./applicant-sidebar";
import { ApplicationDetail } from "./applicant-detail";
import { ReviewFormPanel } from "./review-form";
import { MHacksLogo } from "@/components/mhacks-logo";

interface ReviewDashboardProps {
  mails: ApplicantData[];
}

export function scoreAvg(rev: ReviewFormData | undefined): string | null {
  if (!rev) return null;
  const vals = [
    rev.motivation,
    rev.builderMindset,
    rev.collaboration,
    rev.creativity,
    rev.diversity,
  ].filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export function ReviewDashboard({ mails: initialMails }: ReviewDashboardProps) {
  const [apps, setApps] = React.useState<ApplicantData[]>(initialMails);
  const [selectedId, setSelectedId] = React.useState<string>(
    initialMails[0]?.id ?? "",
  );
  const [reviews, setReviews] = React.useState<Record<string, ReviewFormData>>(
    {},
  );
  const [query, setQuery] = React.useState("");

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  function handleSave(data: ReviewFormData) {
    if (!selectedId) return;
    setReviews((prev) => ({ ...prev, [selectedId]: data }));
    setApps((prev) =>
      prev.map((a) =>
        a.id === selectedId
          ? {
              ...a,
              status: data.flagForReview ? "flagged" : "reviewed",
              read: true,
              labels: [data.flagForReview ? "flagged" : "reviewed"],
            }
          : a,
      ),
    );
    // Auto-advance to next pending
    const next = apps.find(
      (a) => a.id !== selectedId && a.status === "pending",
    );
    if (next) setSelectedId(next.id);
  }

  const reviewedCount = apps.filter((a) => a.status === "reviewed").length;
  const flaggedCount = apps.filter((a) => a.status === "flagged").length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: '"Red Hat Text", system-ui, sans-serif',
        color: "#1a1a1e",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          height: 50,
          borderBottom: "1px solid #F3F4F6",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          flexShrink: 0,
          background: "#fff",
        }}
      >
        <MHacksLogo />
        <span
          style={{
            fontFamily: '"Red Hat Display", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            color: "#1F51A6",
          }}
        >
          MHacks 2026
        </span>
        <span style={{ color: "#E5E7EB", fontSize: 14 }}>|</span>
        <span
          style={{
            fontFamily: '"Red Hat Display", system-ui, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            color: "#374151",
          }}
        >
          Application Review
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 16,
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          <span style={{ color: "#22C55E", fontWeight: 600 }}>
            {reviewedCount} reviewed
          </span>
          <span style={{ color: "#EF4444", fontWeight: 600 }}>
            {flaggedCount} flagged
          </span>
          <span>{apps.length} total</span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar
          apps={apps}
          reviews={reviews}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          setQuery={setQuery}
        />

        {selected ? (
          <>
            <ApplicationDetail app={selected} />
            <div
              style={{
                width: 300,
                borderLeft: "1px solid #F3F4F6",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                background: "#fff",
              }}
            >
              <ReviewFormPanel
                key={selected.id}
                app={selected}
                existingReview={reviews[selected.id]}
                onSave={handleSave}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9CA3AF",
              fontSize: 14,
            }}
          >
            No application selected
          </div>
        )}
      </div>
    </div>
  );
}
