"use client";

import { broadcastEmail, broadcastSms } from "./actions";
import styles from "./styles.module.css";

function confirm_send(count: number) {
  return confirm(`This will alert all ${count} hackers. Are you sure?`);
}

export default function BroadcastPage() {
  const hackerCount = 0; // TODO: replace with real count

  return (
    <div className={styles.container}>
      <h1>Broadcast Announcements</h1>

      <h2>Email</h2>
      <form action={broadcastEmail} onSubmit={(e) => { if (!confirm_send(hackerCount)) e.preventDefault(); }} className={styles.form}>
        <label>
          Subject
          <br />
          <input name="subject" required className={styles.input} />
        </label>
        <label>
          Body
          <br />
          <textarea name="body" rows={6} required className={styles.textarea} />
        </label>
        <button type="submit" className={styles.button}>Send Email to All Hackers</button>
      </form>

      <hr className={styles.divider} />

      <h2>SMS</h2>
      <form action={broadcastSms} onSubmit={(e) => { if (!confirm_send(hackerCount)) e.preventDefault(); }} className={styles.form}>
        <label>
          Message
          <br />
          <textarea name="message" rows={4} required className={styles.textarea} />
        </label>
        <button type="submit" className={styles.button}>Send SMS to All Hackers</button>
      </form>
    </div>
  );
}
