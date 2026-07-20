export async function sendBulkEmail(
  emails: string[],
  subject: string,
  body: string
): Promise<void> {
  console.log("[placeholder] sendBulkEmail", { emails, subject, body });
}
