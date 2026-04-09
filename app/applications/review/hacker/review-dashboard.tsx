"use client";

import { use, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  FileTextIcon,
  GithubIcon,
  LinkedinIcon,
  GlobeIcon,
  FlagIcon,
  CheckCircleIcon,
  ClockIcon,
} from "lucide-react";
import { HackerApplicant } from "@/lib/schemas/application";
import { ApplicationStatus } from "@/lib/types/applications";
import { ReviewFormData, rating_criteria } from "./raiting-criteria";

// ── Types ────────────────────────────────────────────────────────────────────

// ── Rating Criteria ───────────────────────────────────────────────────────────

// ── Mock Data ─────────────────────────────────────────────────────────────────

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApplicationStatus }) {
  if (status === "reviewed") {
    return (
      <Badge variant="default" className="bg-green-600 text-white">
        Reviewed
      </Badge>
    );
  }
  if (status === "flagged") {
    return <Badge variant="destructive">Flagged</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

function RatingInput({
  label,
  fieldKey,
  value,
  onChange,
}: {
  label: string;
  fieldKey: keyof Omit<ReviewFormData, "flagForReview" | "reviewComments">;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const criteria = rating_criteria.find((c) => c.key === fieldKey)!;
  const clamped = value && value >= 1 && value <= 5 ? value : undefined;
  const description = clamped ? criteria.descriptions[clamped] : undefined;

  return (
    <div className="space-y-1.5">
      <Label className="font-medium">{label}</Label>
      <Input
        type="number"
        min={1}
        max={5}
        placeholder="1 – 5"
        value={value ?? ""}
        onChange={(e) => {
          const raw = parseInt(e.target.value, 10);
          if (isNaN(raw)) {
            onChange(undefined);
          } else {
            onChange(Math.max(1, Math.min(5, raw)));
          }
        }}
        className="w-24"
      />
      {description && (
        <p className="text-xs text-muted-foreground italic">{description}</p>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean;
}) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-40 shrink-0">{label}</span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );
}

function EssayBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReviewDashboard({
  applicationsPromise,
}: {
  applicationsPromise: Promise<HackerApplicant[]>;
}) {
  const applications = use(applicationsPromise);

  const [applicants, setApplicants] = useState<HackerApplicant[]>(applications);
  const [selectedId, setSelectedId] = useState<string>(applications[0].id);

  const selected = applicants.find((a) => a.id === selectedId)!;

  const { control, handleSubmit, watch, reset } = useForm<ReviewFormData>({
    defaultValues: {
      motivation: undefined,
      builderMindset: undefined,
      collaboration: undefined,
      creativity: undefined,
      diversity: undefined,
      flagForReview: false,
      reviewComments: "",
    },
  });

  const watchedValues = watch();

  function onSelectApplicant(id: string) {
    setSelectedId(id);
    reset({
      motivation: undefined,
      builderMindset: undefined,
      collaboration: undefined,
      creativity: undefined,
      diversity: undefined,
      flagForReview: false,
      reviewComments: "",
    });
  }

  function onSubmit(data: ReviewFormData) {
    const newStatus: ApplicationStatus = data.flagForReview
      ? "flagged"
      : "reviewed";
    setApplicants((prev) =>
      prev.map((a) => (a.id === selectedId ? { ...a, status: newStatus } : a)),
    );
    // Dummy resume load — replace with S3 later
    console.log("Review submitted for", selected.name, data);
    // Advance to next pending applicant if any
    const next = applicants.find(
      (a) => a.id !== selectedId && a.status === "pending",
    );
    if (next) onSelectApplicant(next.id);
    else reset();
  }

  // Dummy resume loader
  function loadResume(applicantId: string): string {
    // TODO: replace with S3 presigned URL lookup
    return `https://dummy-s3-bucket.example.com/resumes/${applicantId}.pdf`;
  }

  const reviewed = applicants.filter((a) => a.status !== "pending").length;
  const total = applicants.length;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Left panel: applicant list ───────────────────────────────────── */}
      <div className="w-80 shrink-0 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Application Review</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {reviewed} / {total} reviewed
          </p>
        </div>

        <div className="overflow-y-auto flex-1">
          {applicants.map((applicant) => (
            <button
              key={applicant.id}
              onClick={() => onSelectApplicant(applicant.id)}
              className={cn(
                "w-full text-left px-4 py-3 border-b transition-colors hover:bg-muted/50",
                selectedId === applicant.id && "bg-muted",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">
                  {applicant.name}
                </span>
                <StatusBadge status={applicant.status as ApplicationStatus} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {applicant.university}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {applicant.major} · {applicant.degree}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: application detail + review form ────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{selected.name}</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {selected.university} · {selected.major} · {selected.degree} ·
                Class of {selected.graduationYear}
              </p>
            </div>
            <StatusBadge status={selected.status as ApplicationStatus} />
          </div>

          {/* Personal & Academic */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal & Academic</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <InfoRow label="Age" value={selected.age} />
              <InfoRow label="Gender" value={selected.gender} />
              <InfoRow label="Ethnicity" value={selected.ethnicity} />
              <InfoRow label="Country" value={selected.country} />
              <InfoRow
                label="Graduation Year"
                value={selected.graduationYear}
              />
              <InfoRow
                label="Previous Hackathons"
                value={selected.previousHackathons}
              />
            </CardContent>
          </Card>

          {/* Essays */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Essays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EssayBlock
                label="Why do you want to attend MHacks?"
                text={selected.whyAttend}
              />
              <Separator />
              <EssayBlock
                label="Describe a technical challenge you've faced and how you solved it."
                text={selected.technicalChallenge}
              />
              <Separator />
              <EssayBlock
                label="Tell us about a project you're proud of."
                text={selected.proudProject}
              />
              {selected.anythingElse && (
                <>
                  <Separator />
                  <EssayBlock
                    label="Anything else?"
                    text={selected.anythingElse}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Logistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <InfoRow
                label="Transportation"
                value={selected.transportationType}
              />
              <InfoRow label="Coming from" value={selected.comingFrom} />
              <InfoRow label="Shirt size" value={selected.shirtSize} />
              <InfoRow
                label="Allergies"
                value={
                  selected.hasAllergies
                    ? (selected.allergiesDescription ?? "Yes")
                    : "None"
                }
              />
              <InfoRow
                label="Travel reimbursement"
                value={
                  selected.needsTravelReimbursement ? "Requested" : "Not needed"
                }
              />
            </CardContent>
          </Card>

          {/* Socials & Resume */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Socials & Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selected.github && (
                <a
                  href={selected.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <GithubIcon className="size-4" />
                  {selected.github}
                </a>
              )}
              {selected.linkedin && (
                <a
                  href={selected.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <LinkedinIcon className="size-4" />
                  {selected.linkedin}
                </a>
              )}
              {selected.personalSite && (
                <a
                  href={selected.personalSite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <GlobeIcon className="size-4" />
                  {selected.personalSite}
                </a>
              )}
              <button
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                onClick={() => {
                  const url = loadResume(selected.id);
                  window.open(url, "_blank");
                }}
              >
                <FileTextIcon className="size-4" />
                View Resume (dummy)
              </button>
            </CardContent>
          </Card>

          {/* Review Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
              <CardDescription>
                Rate each criterion 1–5. The description updates as you type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {rating_criteria.map((criterion) => (
                  <Controller
                    key={criterion.key}
                    name={criterion.key}
                    control={control}
                    render={({ field }) => (
                      <RatingInput
                        label={criterion.label}
                        fieldKey={criterion.key}
                        value={field.value as number | undefined}
                        onChange={field.onChange}
                      />
                    )}
                  />
                ))}

                <Separator />

                {/* Flag for review */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Controller
                      name="flagForReview"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="flagForReview"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label
                      htmlFor="flagForReview"
                      className="cursor-pointer flex items-center gap-1.5"
                    >
                      <FlagIcon className="size-4 text-destructive" />
                      Flag for review
                    </Label>
                  </div>

                  {watchedValues.flagForReview && (
                    <Controller
                      name="reviewComments"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          placeholder="Explain why this application is being flagged..."
                          rows={3}
                        />
                      )}
                    />
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="submit">
                    {watchedValues.flagForReview ? (
                      <span className="flex items-center gap-2">
                        <FlagIcon className="size-4" /> Submit & Flag
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircleIcon className="size-4" /> Submit Review
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
