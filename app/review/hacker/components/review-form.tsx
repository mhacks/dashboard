"use client"

import * as React from "react"
import { useForm, useWatch, Controller } from "react-hook-form"
import { type ApplicantData } from "../applicant-data"
import { type ReviewFormData, rating_criteria } from "../review-criteria"

const SCORE_STYLE: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  2: { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  3: { bg: "#FEFCE8", color: "#92400E", border: "#FDE68A" },
  4: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
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
        <label style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
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
            width: 52, height: 32, borderRadius: 6, border: "1.5px solid #E2E8F0",
            padding: "0 8px", fontSize: 15, fontWeight: 700, color: "#1F51A6",
            textAlign: "center", outline: "none", fontFamily: "inherit", background: "#fff",
          }}
        />
      </div>
      {desc && sc && (
        <div style={{
          fontSize: 11, lineHeight: 1.5, padding: "5px 10px", borderRadius: 6,
          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
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
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#9CA3AF", textTransform: "uppercase" }}>
          Review
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

        <div style={{ height: 1, background: "#F3F4F6", margin: "16px 0" }} />

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
              <span style={{ fontSize: 12, fontWeight: 500, color: field.value ? "#EF4444" : "#374151" }}>
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
                border: flagged ? "1.5px solid #FECACA" : "1.5px solid #E2E8F0",
                padding: "8px 10px", fontSize: 12, fontFamily: "inherit", color: "#374151",
                background: flagged ? "#FEF2F2" : "#F9FAFB",
                resize: "vertical", outline: "none", lineHeight: 1.5,
              }}
            />
          )}
        />
      </div>

      {/* Save button */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6" }}>
        <button
          type="submit"
          style={{
            width: "100%", height: 36, borderRadius: 8, background: "#1F51A6",
            border: "none", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "#184396" }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "#1F51A6" }}
        >
          Save Review
        </button>
      </div>
    </form>
  )
}
