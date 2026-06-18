"use client"

import * as React from "react"
import { useForm, useWatch, Controller } from "react-hook-form"
import { type ApplicantData } from "../applicant-data"
import { type ReviewFormData, rating_criteria } from "../review-criteria"

const SCORE_STYLE: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  2: { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  3: { bg: "#FEFCE8", color: "#92400E", border: "#FDE68A" },
  4: { bg: "#f0efe6", color: "#3A4A26", border: "rgba(58,74,38,0.25)" },
  5: { bg: "#F0FDF4", color: "#166534", border: "#BBF7D0" },
}

const EMPTY_REVIEW: ReviewFormData = {
  motivation: undefined,
  builderMindset: undefined,
  collaboration: undefined,
  creativity: undefined,
  diversity: undefined,
  flagForReview: false,
  reviewComments: "",
}

function RatingField({
  criterion,
  value,
  onChange,
}: {
  criterion: (typeof rating_criteria)[number]
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  const n = value && value >= 1 && value <= 5 ? value : undefined
  const sc = n ? SCORE_STYLE[n] : null
  const desc = n ? criterion.descriptions[n] : null

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{
          fontSize: 12, fontWeight: 500, color: "#3A4A26",
          fontFamily: "var(--font-geist-sans), system-ui",
        }}>
          {criterion.label}
        </label>
        <input
          type="number"
          min={1}
          max={5}
          placeholder="—"
          value={value ?? ""}
          onChange={(e) => {
            const raw = parseInt(e.target.value, 10)
            if (isNaN(raw)) onChange(undefined)
            else onChange(Math.max(1, Math.min(5, raw)))
          }}
          style={{
            width: 52, height: 32, borderRadius: 8, border: "1.5px solid rgba(58,74,38,0.2)",
            padding: "0 8px", fontSize: 15, fontWeight: 700, color: "#3A4A26",
            textAlign: "center", outline: "none",
            fontFamily: "var(--font-geist-mono), monospace", background: "#fff",
          }}
        />
      </div>
      {desc && sc && (
        <div style={{
          fontSize: 11, lineHeight: 1.5, padding: "5px 10px", borderRadius: 6,
          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
          fontFamily: "var(--font-geist-mono), monospace",
        }}>
          {n}/5 — {desc}
        </div>
      )}
    </div>
  )
}

interface ReviewFormPanelProps {
  app: ApplicantData
  existingReview: ReviewFormData | undefined
  onSave: (data: ReviewFormData) => void
}

export function ReviewFormPanel({ app, existingReview, onSave }: ReviewFormPanelProps) {
  const { control, handleSubmit, reset } = useForm<ReviewFormData>({
    defaultValues: existingReview ?? EMPTY_REVIEW,
  })
  const flagged = useWatch({ control, name: "flagForReview" })

  React.useEffect(() => {
    reset(existingReview ?? EMPTY_REVIEW)
  }, [app.id, existingReview, reset])

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(58,74,38,0.12)" }}>
        <div style={{
          fontSize: 11, fontWeight: 500, letterSpacing: "0.28em",
          color: "rgba(58,74,38,0.5)", textTransform: "uppercase",
          fontFamily: "var(--font-geist-mono), monospace",
        }}>
          ◆ Review
        </div>
      </div>

      {/* Criteria */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {rating_criteria.map((criterion) => (
          <Controller
            key={criterion.key}
            name={criterion.key as keyof Omit<ReviewFormData, "flagForReview" | "reviewComments">}
            control={control}
            render={({ field }) => (
              <RatingField
                criterion={criterion}
                value={field.value as number | undefined}
                onChange={field.onChange}
              />
            )}
          />
        ))}

        <div style={{ height: 1, background: "rgba(58,74,38,0.1)", margin: "16px 0" }} />

        {/* Flag checkbox */}
        <Controller
          name="flagForReview"
          control={control}
          render={({ field }) => (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "#EF4444", cursor: "pointer" }}
              />
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: field.value ? "#B91C1C" : "rgba(58,74,38,0.75)",
                fontFamily: "var(--font-geist-sans), system-ui",
              }}>
                Flag for review
              </span>
            </label>
          )}
        />

        {/* Comments */}
        <Controller
          name="reviewComments"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              placeholder={flagged ? "Add review notes…" : "Optional notes…"}
              style={{
                width: "100%", minHeight: flagged ? 80 : 64, borderRadius: 8,
                border: flagged ? "1.5px solid #FECACA" : "1.5px solid rgba(58,74,38,0.2)",
                padding: "8px 10px", fontSize: 12,
                fontFamily: "var(--font-geist-sans), system-ui",
                color: "rgba(58,74,38,0.85)",
                background: flagged ? "#FEF2F2" : "#fff",
                resize: "vertical", outline: "none", lineHeight: 1.5,
              }}
            />
          )}
        />
      </div>

      {/* Save button */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(58,74,38,0.12)" }}>
        <button
          type="submit"
          style={{
            width: "100%", height: 38, borderRadius: 999, background: "#3A4A26",
            border: "none", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "var(--font-geist-sans), system-ui",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = "0.82" }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = "1" }}
        >
          Save Review
        </button>
      </div>
    </form>
  )
}
