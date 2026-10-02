import {
  and,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
} from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { formatCents } from "@/lib/currency";
import { db } from "@/lib/db";
import {
  hackerApplicants,
  hackerApplicationDrafts,
} from "@/lib/db/schema/applications";
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
  hasRsvped,
  type ApplicationDecision,
  type DecisionRound,
} from "@/lib/decisions";
import { EARLY_APPLICATIONS_DEADLINE_ISO } from "@/lib/types/application-reviews";
import { isDraftStarted } from "@/lib/application-steps";

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
  // The user id of RSVPed hackers, blank otherwise. Sending signs it into the
  // {{wallet_pass_url}} (Apple) and {{google_wallet_pass_url}} merge fields;
  // use them in a section body as [Add to Apple Wallet]({{wallet_pass_url}})
  // or [Add to Google Wallet]({{google_wallet_pass_url}}). Both links render
  // as their official platform badges; blank links are dropped entirely.
  "wallet_user_id",
] as const;

type SubmittedApplicationGroup = Exclude<
  EmailAudienceDecisionGroup,
  "draft" | "umich"
>;

const decisionGroups: Record<SubmittedApplicationGroup, ApplicationDecision[]> =
  {
    all_applicants: [...APPLICATION_DECISIONS],
    accepted: [
      "early_accepted",
      "early_rsvped",
      "regular_accepted",
      "regular_rsvped",
      "checked_in",
    ],
    rsvped: ["early_rsvped", "regular_rsvped", "checked_in"],
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
    checked_in: ["checked_in"],
  };

// `checked_in` covers both rounds, so a round's RSVPed groups also take the
// checked-in hackers who applied in that round. Without this, a "Regular
// RSVPed" send during the event would skip everyone already through the door.
const checkedInRoundForGroup: Partial<
  Record<SubmittedApplicationGroup, DecisionRound>
> = {
  early_accepted_or_rsvped: "early",
  early_rsvped: "early",
  regular_accepted_or_rsvped: "regular",
  regular_rsvped: "regular",
};

function checkedInAppliedIn(round: DecisionRound) {
  return and(
    eq(hackerApplicants.decision, "checked_in"),
    round === "early"
      ? lt(hackerApplicants.createdAt, EARLY_APPLICATIONS_DEADLINE_ISO)
      : gte(hackerApplicants.createdAt, EARLY_APPLICATIONS_DEADLINE_ISO),
  );
}

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
  if (query.decisionGroup === "draft") {
    return loadDraftAudienceRows();
  }

  if (query.decisionGroup === "umich") {
    return loadUmichAudienceRows();
  }

  const decisions = decisionGroups[query.decisionGroup];
  const checkedInRound = checkedInRoundForGroup[query.decisionGroup];
  const inDecisionGroup = checkedInRound
    ? or(
        inArray(hackerApplicants.decision, decisions),
        checkedInAppliedIn(checkedInRound),
      )
    : inArray(hackerApplicants.decision, decisions);
  const conditions = [inDecisionGroup, isNotNull(users.email)];

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
      userId: users.id,
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

async function loadUmichAudienceRows() {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(ilike(users.email, "%@umich.edu"))
    .orderBy(asc(users.email));

  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    role: row.role,
    firstName: "",
    lastName: "",
    decision: "",
    reimbursementStatus: null,
    reimbursementCents: null,
    rsvpId: null,
    rsvpTravelPlan: null,
    rsvpSubmittedAt: null,
  }));
}

async function loadDraftAudienceRows() {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      role: users.role,
      data: hackerApplicationDrafts.data,
    })
    .from(hackerApplicationDrafts)
    .innerJoin(users, eq(users.id, hackerApplicationDrafts.userId))
    .leftJoin(
      hackerApplicants,
      eq(hackerApplicants.userId, hackerApplicationDrafts.userId),
    )
    .where(isNull(hackerApplicants.id))
    .orderBy(asc(hackerApplicationDrafts.updatedAt));

  return rows.flatMap((row) => {
    const data = row.data as Record<string, unknown>;
    if (!isDraftStarted(data)) {
      return [];
    }

    return [
      {
        userId: row.userId,
        email: row.email,
        role: row.role,
        firstName: draftString(data, "firstName"),
        lastName: draftString(data, "lastName"),
        decision: "",
        reimbursementStatus: null,
        reimbursementCents: null,
        rsvpId: null,
        rsvpTravelPlan: null,
        rsvpSubmittedAt: null,
      },
    ];
  });
}

function draftString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" ? value : "";
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
    case "wallet_user_id":
      // Same rule as the dashboard QR (getCheckInCodeHolder): an RSVP row and
      // a confirmed decision. The Wallet routes re-check on download.
      // Draft and umich rows carry decision "", which hasRsvped rejects.
      return row.rsvpId && hasRsvped(row.decision as ApplicationDecision)
        ? row.userId
        : "";
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
  if (group === "draft") {
    return "draft application (not submitted)";
  }

  if (group === "umich") {
    return "users with an @umich.edu email";
  }

  return group.replaceAll("_", " ");
}
