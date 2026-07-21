export async function sendBulkEmail(
  emails: string[],
  subject: string,
  body: string
): Promise<{ succeeded: string[] }> {
  console.log("[placeholder] sendBulkEmail", { emails, subject, body });
  return { succeeded: emails };
}
