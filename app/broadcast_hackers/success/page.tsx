import { redirect } from "next/navigation";
import styles from "../styles.module.css";

export default async function BroadcastSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel } = await searchParams;

  if (channel !== "email" && channel !== "sms") {
    redirect("/broadcast_hackers");
  }

  const label = channel === "email" ? "Email" : "SMS";

  return (
    <div className={styles.container}>
      <h1>{label} sent successfully.</h1>
      <a href="/broadcast_hackers" className={styles.button}>Send another?</a>
    </div>
  );
}
