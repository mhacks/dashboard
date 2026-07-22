import styles from "../styles.module.css";

export default function BroadcastSuccessPage() {
  return (
    <div className={styles.container}>
      <h1>Broadcast sent successfully.</h1>
      <div className={styles.form}>
        <a href="/broadcast_hackers" className={styles.button}>
          Send another
        </a>
        <a href="/broadcast_hackers/logs" className={styles.button}>
          View logs
        </a>
      </div>
    </div>
  );
}
