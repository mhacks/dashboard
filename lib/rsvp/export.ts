import { serializeCsv, type CsvColumn } from "@/lib/csv";
import { formatCents } from "@/lib/currency";
import type { RsvpStatus } from "@/lib/rsvp/status";
import type { AdminRsvpAward } from "@/lib/types/admin-rsvps";
import type { RsvpFormData } from "@/lib/types/rsvps";

export type AdminRsvpExportRow = {
  applicationSlug: string;
  applicationName: string;
  accountEmail: string;
  status: RsvpStatus;
  submittedAt: string | null;
  award: AdminRsvpAward | null;
  values: RsvpFormData | null;
};

const STATUS_LABELS: Record<RsvpStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
};

const TRAVEL_LABELS: Record<RsvpFormData["travelPlan"], string> = {
  local: "Local to Ann Arbor region",
  "self-funded": "Self-funded travel",
  reimbursement: "Travel reimbursement",
};

const DIETARY_LABELS: Record<
  RsvpFormData["dietaryRestrictions"][number],
  string
> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  kosher: "Kosher",
  halal: "Halal",
  "gluten-free": "Gluten-free",
  "nut-free": "Nut-free",
  "dairy-free": "Dairy-free",
  none: "None",
  other: "Other",
};

const ADMIN_RSVP_COLUMNS: readonly CsvColumn<AdminRsvpExportRow>[] = [
  { header: "Application Slug", value: (row) => row.applicationSlug },
  { header: "Application Name", value: (row) => row.applicationName },
  { header: "Account Email", value: (row) => row.accountEmail },
  { header: "RSVP Status", value: (row) => STATUS_LABELS[row.status] },
  { header: "Submitted At", value: (row) => row.submittedAt },
  { header: "First Name", value: (row) => row.values?.firstName },
  { header: "Last Name", value: (row) => row.values?.lastName },
  { header: "Email", value: (row) => row.values?.email },
  {
    header: "Dietary Restrictions",
    value: (row) =>
      row.values?.dietaryRestrictions.map((value) => DIETARY_LABELS[value]),
  },
  {
    header: "Other Dietary Restriction",
    value: (row) => row.values?.otherDietaryRestriction,
  },
  { header: "T-Shirt Size", value: (row) => row.values?.tshirtSize },
  {
    header: "Travel Plan",
    value: (row) =>
      row.values ? TRAVEL_LABELS[row.values.travelPlan] : undefined,
  },
  {
    header: "Travel Guide Acknowledged",
    value: (row) => row.values?.travelGuideAcknowledged,
  },
  { header: "Flight Booked", value: (row) => row.values?.flightBooked },
  {
    header: "Reimbursement Region",
    value: (row) => row.award?.regionLabel,
  },
  {
    header: "Reimbursement Amount",
    value: (row) =>
      row.award ? formatCents(row.award.amountCents) : undefined,
  },
  {
    header: "Receipt Filename",
    value: (row) => row.values?.receipt?.originalName,
  },
  {
    header: "Receipt Binding Acknowledged",
    value: (row) => row.values?.receiptBindingAcknowledged,
  },
  { header: "Street Address", value: (row) => row.values?.streetAddress },
  { header: "City", value: (row) => row.values?.city },
  {
    header: "State/Province",
    value: (row) => row.values?.stateOrProvince,
  },
  { header: "ZIP/Postal Code", value: (row) => row.values?.postalCode },
  { header: "Country", value: (row) => row.values?.country },
  {
    header: "Activities Waiver",
    value: (row) => row.values?.activitiesWaiverResponse,
  },
  {
    header: "Photo Release",
    value: (row) => row.values?.photoReleaseResponse,
  },
  { header: "Anything Else", value: (row) => row.values?.additionalNotes },
];

export function serializeAdminRsvpExport(
  rows: readonly AdminRsvpExportRow[],
): string {
  return serializeCsv(ADMIN_RSVP_COLUMNS, rows);
}
