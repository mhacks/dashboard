"use client";

import { useState } from "react";
import { broadcastAll } from "./actions";
import styles from "./styles.module.css";

const BODY_LIMIT = 160;

export default function BroadcastForm({ hackerCount }: { hackerCount: number }) {
  const [bodyLength, setBodyLength] = useState(0);

  return (
    <form
      action={broadcastAll}
      onSubmit={(e) => {
        if (!confirm(`This will alert all ${hackerCount} hackers. Are you sure?`)) {
          e.preventDefault();
        }
      }}
      className={styles.form}
    >
      <label>
        Subject (email only)
        <br />
        <input name="subject" required className={styles.input} />
      </label>
      <label>
        Body
        <br />
        <textarea
          name="body"
          rows={4}
          required
          maxLength={BODY_LIMIT}
          className={styles.textarea}
          onChange={(e) => setBodyLength(e.target.value.length)}
        />
        <span>
          {bodyLength} / {BODY_LIMIT}
        </span>
      </label>
      <button type="submit" className={styles.button}>
        Send to All Hackers
      </button>
    </form>
  );
}
