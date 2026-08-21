import { and, asc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { formatCents } from "@/lib/currency";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { users } from "@/lib/db/schema/users";
import {
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import { parseRecipientText } from "@/lib/email/campaigns/recipients";
import {
  emailAudienceResolveSchema,
  type EmailAudienceDecisionGroup,
  type EmailAudienceQuery,
} from "@/lib/email/types";
import {
  APPLICATION_DECISIONS,
  type ApplicationDecision,
} from "@/lib/decisions";

const audienceCsvColumns = [
  "email",
  "name",
  "first_name",
  "last_name",
  "application_decision",
  "user_role",
  "has_travel_reimbursement",
  "travel_reimbursement",
  "rsvp_submitted",
  "rsvp_travel_plan",
  "rsvp_submitted_at",
] as const;

const decisionGroups: Record<
  EmailAudienceDecisionGroup,
  ApplicationDecision[]
> = {
  all_applicants: [...APPLICATION_DECISIONS],
  accepted: [
    "early_accepted",
    "early_rsvped",
    "regular_accepted",
    "regular_rsvped",
  ],
  rsvped: ["early_rsvped", "regular_rsvped"],
  rejected: ["early_rejected", "regular_rejected"],
  early_accepted_or_rsvped: ["early_accepted", "early_rsvped"],
  regular_accepted_or_rsvped: ["regular_accepted", "regular_rsvped"],
  applied: ["applied"],
  early_accepted: ["early_accepted"],
  early_rsvped: ["early_rsvped"],
  early_rejected: ["early_rejected"],
  regular_accepted: ["regular_accepted"],
  regular_rsvped: ["regular_rsvped"],
  regular_rejected: ["regular_rejected"],
};

export async function resolveEmailAudience(input: unknown) {
  await requireOrganizer();
  const body = emailAudienceResolveSchema.parse(input);
  const query = body.query;
  const rows = await loadAudienceRows(query);
  const recipientText = audienceRowsToCsv(rows);
  const parsed = parseRecipientText(recipientText);
  const { maxRecipients } = getCampaignLimits();

  if (parsed.emails.length > maxRecipients) {
    throw new EmailCampaignError(
      `Audience query returned ${parsed.emails.length} recipients, which exceeds the ${maxRecipients} recipient limit`,
      400,
    );
  }

  return {
    ...parsed,
    recipientText,
    label: describeAudienceQuery(query),
  };
}

async function loadAudienceRows(query: EmailAudienceQuery) {
  const decisions = decisionGroups[query.decisionGroup];
  const conditions = [
    inArray(hackerApplicants.decision, decisions),
    isNotNull(users.email),
  ];

  if (query.travelAward === "approved") {
    conditions.push(eq(hackerReimbursements.status, "approved"));
  } else if (query.travelAward === "none") {
    const noApprovedTravelAward = or(
      isNull(hackerReimbursements.id),
      ne(hackerReimbursements.status, "approved"),
    );

    if (noApprovedTravelAward) {
      conditions.push(noApprovedTravelAward);
    }
  }

  if (query.rsvpTravelPlan !== "any") {
    conditions.push(eq(hackerRsvps.travelPlan, query.rsvpTravelPlan));
  }

  return db
    .select({
      email: users.email,
      role: users.role,
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
      decision: hackerApplicants.decision,
      reimbursementStatus: hackerReimbursements.status,
      reimbursementCents: reimbursementRegions.amountCents,
      rsvpId: hackerRsvps.id,
      rsvpTravelPlan: hackerRsvps.travelPlan,
      rsvpSubmittedAt: hackerRsvps.submittedAt,
    })
    .from(hackerApplicants)
    .innerJoin(users, eq(users.id, hackerApplicants.userId))
    .leftJoin(
      hackerReimbursements,
      eq(hackerReimbursements.userId, hackerApplicants.userId),
    )
    .leftJoin(
      reimbursementRegions,
      eq(reimbursementRegions.region, hackerReimbursements.region),
    )
    .leftJoin(hackerRsvps, eq(hackerRsvps.applicationId, hackerApplicants.id))
    .where(and(...conditions))
    .orderBy(asc(hackerApplicants.createdAt));
}

function audienceRowsToCsv(rows: Awaited<ReturnType<typeof loadAudienceRows>>) {
  return [
    audienceCsvColumns.join(","),
    ...rows.map((row) =>
      audienceCsvColumns
        .map((column) => csvValue(audienceCellValue(row, column)))
        .join(","),
    ),
  ].join("\n");
}

function audienceCellValue(
  row: Awaited<ReturnType<typeof loadAudienceRows>>[number],
  column: (typeof audienceCsvColumns)[number],
) {
  const firstName = row.firstName.trim();
  const lastName = row.lastName.trim();
  const hasTravelReimbursement = row.reimbursementStatus === "approved";

  switch (column) {
    case "email":
      return row.email.toLowerCase();
    case "name":
      return [firstName, lastName].filter(Boolean).join(" ") || row.email;
    case "first_name":
      return firstName;
    case "last_name":
      return lastName;
    case "application_decision":
      return row.decision;
    case "user_role":
      return row.role;
    case "has_travel_reimbursement":
      return hasTravelReimbursement ? "true" : "false";
    case "travel_reimbursement":
      return hasTravelReimbursement && row.reimbursementCents !== null
        ? formatCents(row.reimbursementCents)
        : "";
    case "rsvp_submitted":
      return row.rsvpId ? "true" : "false";
    case "rsvp_travel_plan":
      return row.rsvpTravelPlan ?? "";
    case "rsvp_submitted_at":
      return row.rsvpSubmittedAt ?? "";
  }
}

function csvValue(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function describeAudienceQuery(query: EmailAudienceQuery) {
  const parts = [decisionGroupLabel(query.decisionGroup)];

  if (query.travelAward === "approved") {
    parts.push("approved travel reimbursement");
  } else if (query.travelAward === "none") {
    parts.push("no approved travel reimbursement");
  }

  if (query.rsvpTravelPlan !== "any") {
    parts.push(`${query.rsvpTravelPlan} travel plan`);
  }

  return parts.join(" + ");
}

function decisionGroupLabel(group: EmailAudienceDecisionGroup) {
  return group.replaceAll("_", " ");
}
