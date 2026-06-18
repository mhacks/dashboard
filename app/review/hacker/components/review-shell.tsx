"use client";

import * as React from "react";
import Image from "next/image";
import { type ApplicantData } from "../applicant-data";
import { type ReviewFormData } from "../review-criteria";
import { Sidebar } from "./applicant-sidebar";
import { ApplicationDetail } from "./applicant-detail";
import { ReviewFormPanel } from "./review-form";
import { MHacksLogo } from "@/components/mhacks-logo";
import { saveHackerReview } from "@/lib/actions/review.server.actions";
import { use } from "react";

interface MailProps {
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

export function ReviewDashboard({ applicationsPromise }: any) {
  const applications: ApplicantData[] = use(applicationsPromise);

  const [apps, setApps] = React.useState<ApplicantData[]>(applications);
  const [selectedId, setSelectedId] = React.useState<string>(
    applications[0]?.id ?? "",
  );
  const [reviews, setReviews] = React.useState<Record<string, ReviewFormData>>(
    () =>
      Object.fromEntries(
        applications
          .filter((a) => a.status !== "pending")
          .map((a) => [
            a.id,
            {
              motivation: a.reviewMotivation,
              builderMindset: a.reviewBuilderMindset,
              collaboration: a.reviewCollaboration,
              creativity: a.reviewCreativity,
              diversity: a.reviewDiversity,
              flagForReview: a.flagForReview ?? false,
              reviewComments: a.reviewNotes ?? "",
            },
          ]),
      ),
  );
  const [query, setQuery] = React.useState("");

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  async function handleSave(data: ReviewFormData) {
    if (!selectedId) return;
    await saveHackerReview(selectedId, data);
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
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#3A4A26",
        background: "#f4f2e8",
      }}
    >
      {/* ── Header — matches apply/hacker style ───────────────────── */}
      <header className="relative overflow-hidden flex-shrink-0">
        <Image
          src="/sponsors_bg.png"
          alt=""
          fill
          className="object-cover object-center brightness-[1.15] contrast-[1.2] saturate-[1.3]"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative px-6 h-14 flex items-center gap-3">
          <MHacksLogo size={24} />
          <span className="font-heading italic text-lg text-white">
            MHacks 2026
          </span>
          <span className="text-white/30 mx-1">|</span>
          <span className="text-[13px] text-white/60 font-medium">
            Application Review
          </span>
        </div>
      </header>

      {/* ── Stats sub-bar ──────────────────────────────────────────── */}
      <div
        style={{
          height: 36,
          borderBottom: "1px solid rgba(58,74,38,0.12)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 16,
          flexShrink: 0,
          background: "#f0efe6",
          fontSize: 11,
          fontFamily: "var(--font-geist-mono), monospace",
          letterSpacing: "0.05em",
        }}
      >
        <span style={{ color: "#166534", fontWeight: 600 }}>
          {reviewedCount} reviewed
        </span>
        <span style={{ color: "#B91C1C", fontWeight: 600 }}>
          {flaggedCount} flagged
        </span>
        <span style={{ color: "rgba(58,74,38,0.5)" }}>{apps.length} total</span>
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
                borderLeft: "1px solid rgba(58,74,38,0.12)",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                background: "#f4f2e8",
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
              color: "rgba(58,74,38,0.4)",
              fontSize: 13,
              fontFamily: "var(--font-geist-mono), monospace",
              letterSpacing: "0.1em",
            }}
          >
            No application selected
          </div>
        )}
      </div>
    </div>
  );
}
