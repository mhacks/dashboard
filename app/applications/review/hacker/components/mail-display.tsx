"use client"

import { format } from "date-fns"
import {
  CheckCircle,
  FileText,
  Flag,
  Forward,
  Github,
  Globe,
  Linkedin,
  MoreVertical,
  SkipForward,
  Trash2,
} from "lucide-react"
import { useForm, useWatch, Controller } from "react-hook-form"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { type Mail } from "../data"
import { ReviewFormData, rating_criteria } from "../raiting-criteria"

// ── Review form helpers ───────────────────────────────────────────────────────

const EMPTY_REVIEW: ReviewFormData = {
  motivation: undefined,
  builderMindset: undefined,
  collaboration: undefined,
  creativity: undefined,
  diversity: undefined,
  flagForReview: false,
  reviewComments: "",
}

function RatingInput({
  label,
  fieldKey,
  value,
  onChange,
}: {
  label: string
  fieldKey: keyof Omit<ReviewFormData, "flagForReview" | "reviewComments">
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  const criteria = rating_criteria.find((c) => c.key === fieldKey)!
  const clamped = value && value >= 1 && value <= 5 ? value : undefined
  const description = clamped ? criteria.descriptions[clamped] : undefined

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        type="number"
        min={1}
        max={5}
        placeholder="1–5"
        value={value ?? ""}
        onChange={(e) => {
          const raw = parseInt(e.target.value, 10)
          if (isNaN(raw)) onChange(undefined)
          else onChange(Math.max(1, Math.min(5, raw)))
        }}
        className="w-20 h-8 text-sm"
      />
      {description && (
        <p className="text-xs italic text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MailDisplayProps {
  mail: Mail | null
  onReview: (id: string, data: ReviewFormData) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MailDisplay({ mail, onReview }: MailDisplayProps) {
  const { control, handleSubmit, getValues, reset } = useForm<ReviewFormData>({
    defaultValues: EMPTY_REVIEW,
  })
  const flagForReview = useWatch({ control, name: "flagForReview" })

  function submitReview(flag: boolean) {
    if (!mail) return
    onReview(mail.id, { ...getValues(), flagForReview: flag })
    reset(EMPTY_REVIEW)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center p-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!mail}
                onClick={() => submitReview(false)}
              >
                <CheckCircle className="h-4 w-4" />
                <span className="sr-only">Mark reviewed</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark reviewed</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!mail}
                onClick={() => submitReview(true)}
              >
                <Flag className="h-4 w-4" />
                <span className="sr-only">Flag</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Flag for review</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail}>
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Reject</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail}>
                <SkipForward className="h-4 w-4" />
                <span className="sr-only">Skip</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Skip for now</TooltipContent>
          </Tooltip>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail}>
                <Forward className="h-4 w-4" />
                <span className="sr-only">Share</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share application</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!mail}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Copy applicant email</DropdownMenuItem>
            <DropdownMenuItem>View raw application</DropdownMenuItem>
            <DropdownMenuItem>Add internal note</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {mail ? (
        <div className="flex flex-1 flex-col min-h-0">
          {/* Header */}
          <div className="flex items-start p-4">
            <div className="flex items-start gap-4 text-sm">
              <Avatar>
                <AvatarImage alt={mail.name} />
                <AvatarFallback>
                  {mail.name
                    .split(" ")
                    .map((chunk) => chunk[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                <div className="font-semibold">{mail.name}</div>
                <div className="line-clamp-1 text-xs">{mail.subject}</div>
                <div className="line-clamp-1 text-xs">
                  <span className="font-medium">Email:</span> {mail.email}
                </div>
              </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              {mail.date && (
                <div className="text-xs text-muted-foreground">
                  {format(new Date(mail.date), "PPpp")}
                </div>
              )}
              <Badge
                variant={
                  mail.status === "reviewed"
                    ? "default"
                    : mail.status === "flagged"
                    ? "destructive"
                    : "secondary"
                }
              >
                {mail.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Application body */}
          <ScrollArea className="flex-1">
            <div className="space-y-5 p-4 text-sm">
              {/* Quick stats */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Age {mail.age}</Badge>
                <Badge variant="outline">{mail.gender}</Badge>
                <Badge variant="outline">{mail.ethnicity}</Badge>
                <Badge variant="outline">{mail.country}</Badge>
                <Badge variant="outline">Class of {mail.graduationYear}</Badge>
                <Badge variant="outline">{mail.previousHackathons} hackathons</Badge>
              </div>

              <Separator />

              {/* Essays */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why MHacks?</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{mail.whyAttend}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Technical Challenge</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{mail.technicalChallenge}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proud Project</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{mail.proudProject}</p>
                </div>
                {mail.anythingElse && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anything Else</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{mail.anythingElse}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Logistics */}
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-muted-foreground">Transportation</span>
                <span>{mail.transportationType}</span>
                <span className="text-muted-foreground">Coming from</span>
                <span>{mail.comingFrom}</span>
                <span className="text-muted-foreground">Shirt size</span>
                <span>{mail.shirtSize}</span>
                <span className="text-muted-foreground">Allergies</span>
                <span>{mail.hasAllergies ? (mail.allergiesDescription ?? "Yes") : "None"}</span>
                <span className="text-muted-foreground">Travel reimbursement</span>
                <span>{mail.needsTravelReimbursement ? "Requested" : "Not needed"}</span>
              </div>

              <Separator />

              {/* Socials */}
              <div className="flex flex-col gap-1.5">
                {mail.github && (
                  <a href={mail.github} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                    <Github className="h-3.5 w-3.5" />{mail.github}
                  </a>
                )}
                {mail.linkedin && (
                  <a href={mail.linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                    <Linkedin className="h-3.5 w-3.5" />{mail.linkedin}
                  </a>
                )}
                {mail.personalSite && (
                  <a href={mail.personalSite} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                    <Globe className="h-3.5 w-3.5" />{mail.personalSite}
                  </a>
                )}
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline w-fit"
                  onClick={() => window.open(`https://dummy-s3.example.com/resumes/${mail.id}.pdf`, "_blank")}
                >
                  <FileText className="h-3.5 w-3.5" />View Resume
                </button>
              </div>
            </div>
          </ScrollArea>

          <Separator className="mt-auto" />

          {/* Review form — replaces the mail reply box */}
          <form onSubmit={handleSubmit((d) => submitReview(d.flagForReview))}>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              </div>
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
                <Label htmlFor="flagForReview" className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <Flag className="h-3.5 w-3.5 text-destructive" />
                  Flag for review
                </Label>
              </div>
              {flagForReview && (
                <Controller
                  name="reviewComments"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      className="p-3 text-sm"
                      placeholder="Explain why this application is being flagged..."
                      rows={2}
                    />
                  )}
                />
              )}
              <div className="flex items-center justify-end">
                <Button size="sm" type="submit">
                  {flagForReview ? "Submit & Flag" : "Submit Review"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">
          No application selected
        </div>
      )}
    </div>
  )
}
