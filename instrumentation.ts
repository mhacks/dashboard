const idleSendSweepIntervalMs = 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) {
    return;
  }

  const { processIdleDirectSends } =
    await import("@/lib/email/campaigns/direct-service");
  let sweeping = false;
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await processIdleDirectSends();
    } catch (error) {
      console.error("Idle email send sweep failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      sweeping = false;
    }
  };

  void sweep();
  setInterval(() => void sweep(), idleSendSweepIntervalMs).unref();
}
