"use client";

import { useState } from "react";
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

// ── Types ────────────────────────────────────────────────────────────────────

type ApplicationStatus = "pending" | "reviewed" | "flagged";

interface Applicant {
  id: string;
  name: string;
  university: string;
  major: string;
  degree: string;
  graduationYear: number;
  age: number;
  gender: string;
  ethnicity: string;
  country: string;
  previousHackathons: number;
  whyAttend: string;
  technicalChallenge: string;
  proudProject: string;
  anythingElse?: string;
  github?: string;
  linkedin?: string;
  personalSite?: string;
  transportationType: string;
  comingFrom: string;
  shirtSize: string;
  hasAllergies: boolean;
  allergiesDescription?: string;
  needsTravelReimbursement: boolean;
  status: ApplicationStatus;
}

// ── Rating Criteria ───────────────────────────────────────────────────────────

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_APPLICANTS: Applicant[] = [
  {
    id: "1",
    name: "Alice Chen",
    university: "University of Michigan",
    major: "Computer Science",
    degree: "Bachelor's",
    graduationYear: 2026,
    age: 21,
    gender: "Female",
    ethnicity: "Asian",
    country: "United States",
    previousHackathons: 4,
    whyAttend:
      "MHacks has always been on my radar as one of the premier hackathons in the midwest. I want to push my skills in ML and build something meaningful with a team. Last year I built a mental-health chatbot at HackMIT and I am excited to iterate on those ideas with the incredibly talented community MHacks attracts.",
    technicalChallenge:
      "During my internship at a startup I had to migrate a monolithic Flask API to microservices with zero downtime. I tackled this by implementing a strangler-fig pattern—routing traffic incrementally through a new gateway while keeping the old endpoints alive until confidence was high. The trickiest part was synchronizing database writes across services; I ended up using an outbox pattern with a Postgres trigger to fan out events.",
    proudProject:
      "I built StudySync, a real-time collaborative study tool that syncs Pomodoro timers and lets friends share notes via WebSockets. Over 300 students at my university use it. I designed the backend in Go, deployed on Fly.io, and added an AI summary feature using the OpenAI API.",
    anythingElse:
      "I play violin in the university orchestra and love hackathon karaoke nights!",
    github: "https://github.com/alicechendev",
    linkedin: "https://linkedin.com/in/alice-chen",
    transportationType: "Driving",
    comingFrom: "Ann Arbor, MI",
    shirtSize: "S",
    hasAllergies: false,
    needsTravelReimbursement: false,
    status: "pending",
  },
  {
    id: "2",
    name: "Marcus Johnson",
    university: "Georgia Institute of Technology",
    major: "Computer Engineering",
    degree: "Bachelor's",
    graduationYear: 2027,
    age: 20,
    gender: "Male",
    ethnicity: "Black or African American",
    country: "United States",
    previousHackathons: 2,
    whyAttend:
      "I want to attend MHacks to network with other engineers and learn from industry mentors. I have been working on embedded systems projects and I think a hackathon environment will push me to prototype faster.",
    technicalChallenge:
      "I had a race condition in an RTOS scheduler I was writing in C. The interrupt handler was modifying shared state without a critical section. I resolved it by using atomic operations and restructuring the ISR to queue events rather than process them inline.",
    proudProject:
      "I built a low-cost air quality monitor with an ESP32, a PM2.5 sensor, and a custom PCB. Data streams to a Firebase backend and displays on a React Native app. I open-sourced the hardware design and got 40 GitHub stars.",
    github: "https://github.com/mjohnsonEE",
    transportationType: "Flying",
    comingFrom: "Atlanta, GA",
    shirtSize: "L",
    hasAllergies: false,
    needsTravelReimbursement: true,
    status: "pending",
  },
  {
    id: "3",
    name: "Priya Patel",
    university: "Massachusetts Institute of Technology",
    major: "Mathematics",
    degree: "Bachelor's",
    graduationYear: 2026,
    age: 22,
    gender: "Female",
    ethnicity: "Asian",
    country: "United States",
    previousHackathons: 6,
    whyAttend:
      "I want to collaborate with builders from diverse disciplines. As a math major who codes, I bring a rigorous analytical lens to product problems. MHacks specifically attracts the type of interdisciplinary team I thrive in.",
    technicalChallenge:
      "I implemented a gradient descent optimizer from scratch for a research project on sparse neural networks. The tricky part was getting numerically stable updates with float32 precision. I used Kahan summation and gradient clipping, and validated against PyTorch's built-in optimizer.",
    proudProject:
      "During HackMIT I led a team of four to build a real-time sign-language translation app using MediaPipe and a custom GRU model. We won first place in the accessibility track. The model achieved 94% accuracy on ASL alphabet recognition.",
    anythingElse:
      "I am a TA for 18.06 (Linear Algebra) and love making math accessible.",
    github: "https://github.com/priyapatel-math",
    linkedin: "https://linkedin.com/in/priya-patel-mit",
    personalSite: "https://priyapatel.dev",
    transportationType: "Train",
    comingFrom: "Cambridge, MA",
    shirtSize: "XS",
    hasAllergies: true,
    allergiesDescription: "Tree nuts",
    needsTravelReimbursement: false,
    status: "reviewed",
  },
  {
    id: "4",
    name: "Jordan Smith",
    university: "University of Illinois at Urbana-Champaign",
    major: "Business",
    degree: "Bachelor's",
    graduationYear: 2027,
    age: 20,
    gender: "Other",
    ethnicity: "White",
    country: "United States",
    previousHackathons: 0,
    whyAttend:
      "I want to attend to learn about technology and meet developers.",
    technicalChallenge:
      "I had to fix a bug in a spreadsheet formula at my internship.",
    proudProject:
      "I built a simple budget tracker in Excel with some VBA macros. It helped my student org manage expenses.",
    transportationType: "Driving",
    comingFrom: "Champaign, IL",
    shirtSize: "M",
    hasAllergies: false,
    needsTravelReimbursement: false,
    status: "flagged",
  },
  {
    id: "5",
    name: "Wei Zhang",
    university: "Carnegie Mellon University",
    major: "Computer Science",
    degree: "Master's",
    graduationYear: 2026,
    age: 24,
    gender: "Male",
    ethnicity: "Asian",
    country: "United States",
    previousHackathons: 8,
    whyAttend:
      "I have been a hackathon organizer at CMU for two years and I want to participate as a hacker this time. I am passionate about building developer tools and I see MHacks as the perfect venue to ship a CLI toolkit I have been designing.",
    technicalChallenge:
      "I rewrote a critical path in a distributed key-value store from a single-threaded model to an async Tokio-based architecture in Rust. The migration required careful management of lifetimes and a redesign of the error-propagation model. Throughput improved 4x.",
    proudProject:
      "MeshDB — an open-source mesh networking library for IoT devices that auto-discovers peers via mDNS and routes packets over BLE or WiFi. Used by 3 research labs and 200+ GitHub stars.",
    github: "https://github.com/wzhang-cmu",
    linkedin: "https://linkedin.com/in/wei-zhang-cmu",
    personalSite: "https://weizhang.io",
    transportationType: "Driving",
    comingFrom: "Pittsburgh, PA",
    shirtSize: "M",
    hasAllergies: false,
    needsTravelReimbursement: false,
    status: "pending",
  },
];

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
  const criteria = RATING_CRITERIA.find((c) => c.key === fieldKey)!;
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

export default function ReviewPage() {
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [selectedId, setSelectedId] = useState<string>(MOCK_APPLICANTS[0].id);

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
                <StatusBadge status={applicant.status} />
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
            <StatusBadge status={selected.status} />
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
                {RATING_CRITERIA.map((criterion) => (
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
