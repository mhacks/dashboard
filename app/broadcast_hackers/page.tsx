import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import BroadcastForm from "./BroadcastForm";
import styles from "./styles.module.css";

export default async function BroadcastPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "organizer") {
    redirect("/");
  }

  const [{ value: hackerCount }] = await db
    .select({ value: count() })
    .from(hackerApplicants);

  return (
    <div className={styles.container}>
      <h1>Broadcast Announcements</h1>
      <p>Warning! This broadcasts to all {hackerCount} hackers through email and SMS.</p>
      <BroadcastForm hackerCount={hackerCount} />
      <hr className={styles.divider} />
      <a href="/broadcast_hackers/logs" className={styles.button}>
        View Logs
      </a>
    </div>
  );
}
