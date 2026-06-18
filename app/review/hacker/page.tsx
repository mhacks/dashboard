export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { users } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";
import { ReviewDashboard } from "./components/review-shell";
import { ReviewDashboardSkeleton } from "./components/review-skeleton";
import { type ApplicantData } from "./applicant-data";
import { getSessionUser } from "@/lib/session";

async function getApplicants(): Promise<ApplicantData[]> {
  const rows = await db
    .select()
    .from(hackerApplicants)
    .leftJoin(users, eq(hackerApplicants.userId, users.id))
    .orderBy(hackerApplicants.createdAt);

  return rows.map(({ hacker_applicants: a, users: u }) => {
    const email = u?.email ?? `applicant-${a.userId.slice(0, 8)}`;
    const name = email.split("@")[0];
    return {
      id: a.id,
      name,
      email,
      subject: `${a.university} · ${a.major} · ${a.degree}`,
      text: a.whyAttend,
      date: a.createdAt.toISOString(),
      read: a.status !== "pending",
      labels: [a.status],
      university: a.university,
      major: a.major,
      degree: a.degree,
      graduationYear: a.graduationYear,
      age: a.age,
      gender: a.gender,
      ethnicity: a.ethnicity,
      country: a.country,
      previousHackathons: a.previousHackathons,
      whyAttend: a.whyAttend,
      technicalChallenge: a.technicalChallenge,
      proudProject: a.proudProject,
      anythingElse: a.anythingElse ?? undefined,
      github: a.github ?? undefined,
      linkedin: a.linkedin ?? undefined,
      personalSite: a.personalSite ?? undefined,
      transportationType: a.transportationType,
      comingFrom: a.comingFrom,
      shirtSize: a.shirtSize,
      hasAllergies: a.hasAllergies,
      allergiesDescription: a.allergiesDescription ?? undefined,
      needsTravelReimbursement: a.needsTravelReimbursement,
      status: a.status,
      reviewMotivation: a.reviewMotivation ?? undefined,
      reviewBuilderMindset: a.reviewBuilderMindset ?? undefined,
      reviewCollaboration: a.reviewCollaboration ?? undefined,
      reviewCreativity: a.reviewCreativity ?? undefined,
      reviewDiversity: a.reviewDiversity ?? undefined,
      flagForReview: a.flagForReview,
      reviewNotes: a.reviewNotes ?? undefined,
    };
  });
}

export default async function ReviewPage() {
  const sessionUser = await getSessionUser();
  if (sessionUser?.role !== "organizer") redirect("/");

  const applicationsPromise = getApplicants();

  return (
    <Suspense fallback={<ReviewDashboardSkeleton />}>
      <ReviewDashboard applicationsPromise={applicationsPromise} />
    </Suspense>
  );
}
