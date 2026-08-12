import { ExternalLinkIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RsvpDraftData, RsvpFormData } from "@/lib/types/rsvps";
import { DIETARY_LABELS, TRAVEL_LABELS } from "./form-options";

type SummaryValues = RsvpDraftData | RsvpFormData;

function answer(value: string | null | undefined): string {
  return value?.trim() || "Not answered";
}

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return "Not answered";
  return value ? "Yes" : "No";
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-5">
      <dt className="font-red-hat text-xs font-semibold text-moss/55">
        {label}
      </dt>
      <dd className="min-w-0 break-words font-red-hat text-sm text-moss">
        {children}
      </dd>
    </div>
  );
}

function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-moss/15 bg-white/35 shadow-none">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-heading text-xl italic text-moss">
          {title}
        </CardTitle>
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <PencilIcon data-icon="inline-start" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col">{children}</dl>
      </CardContent>
    </Card>
  );
}

export function RsvpSummary({
  values,
  onEdit,
  receiptHref,
}: {
  values: SummaryValues;
  onEdit?: (step: number) => void;
  receiptHref?: string;
}) {
  const dietary =
    values.dietaryRestrictions?.map(
      (restriction) => DIETARY_LABELS[restriction],
    ) ?? [];
  if (
    values.dietaryRestrictions?.includes("other") &&
    values.otherDietaryRestriction
  ) {
    dietary.push(values.otherDietaryRestriction);
  }

  return (
    <div className="flex flex-col gap-4">
      <SummarySection title="Personal" onEdit={onEdit && (() => onEdit(0))}>
        <SummaryRow label="Full legal name">
          {answer(values.legalName)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="Preferred name">
          {answer(values.preferredName)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="Email">{answer(values.email)}</SummaryRow>
        <Separator />
        <SummaryRow label="Application email confirmed">
          {yesNo(values.emailMatchesApplication)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="Wrong-email risk acknowledged">
          {yesNo(values.incorrectEmailRiskAcknowledged)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="Dietary restrictions">
          {dietary.length > 0 ? dietary.join(", ") : "Not answered"}
        </SummaryRow>
        <Separator />
        <SummaryRow label="T-shirt size">
          {values.tshirtSize ?? "Not answered"}
        </SummaryRow>
      </SummarySection>

      <SummarySection title="Travel & Tax" onEdit={onEdit && (() => onEdit(1))}>
        <SummaryRow label="Travel plan">
          {values.travelPlan
            ? TRAVEL_LABELS[values.travelPlan]
            : "Not answered"}
        </SummaryRow>
        {values.travelPlan === "reimbursement" && (
          <>
            <Separator />
            <SummaryRow label="Travel Guide acknowledged">
              {yesNo(values.travelGuideAcknowledged)}
            </SummaryRow>
            <Separator />
            <SummaryRow label="Flight booked">
              {yesNo(values.flightBooked)}
            </SummaryRow>
            <Separator />
            <SummaryRow label="Receipt">
              {values.receipt ? (
                receiptHref ? (
                  <a
                    href={receiptHref}
                    className="inline-flex items-center gap-1 underline underline-offset-4"
                  >
                    {values.receipt.originalName}
                    <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  values.receipt.originalName
                )
              ) : (
                "Not uploaded"
              )}
            </SummaryRow>
            <Separator />
            <SummaryRow label="Receipt submission acknowledged">
              {yesNo(values.receiptBindingAcknowledged)}
            </SummaryRow>
          </>
        )}
        <Separator />
        <SummaryRow label="Street address">
          {answer(values.streetAddress)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="City">{answer(values.city)}</SummaryRow>
        <Separator />
        <SummaryRow label="State/Province">
          {answer(values.stateOrProvince)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="ZIP/Postal code">
          {answer(values.postalCode)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="Country">{answer(values.country)}</SummaryRow>
      </SummarySection>

      <SummarySection title="Waivers" onEdit={onEdit && (() => onEdit(2))}>
        <SummaryRow label="Activities Waiver">
          {yesNo(values.activitiesWaiverResponse)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="Photo Release">
          {yesNo(values.photoReleaseResponse)}
        </SummaryRow>
        <Separator />
        <SummaryRow label="Anything else">
          {answer(values.additionalNotes)}
        </SummaryRow>
      </SummarySection>
    </div>
  );
}
