export function isBenignRealtimeChannelError(error: unknown) {
  if (!error) return true;

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("socket closed: 1001") ||
    message.includes("socket closed") ||
    message.includes("Channel closed")
  );
}
