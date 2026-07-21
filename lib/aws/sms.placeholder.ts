export async function sendBulkSMS(
  phoneNumbers: string[],
  message: string
): Promise<{ succeeded: string[] }> {
  console.log("[placeholder] sendBulkSMS", { phoneNumbers, message });
  return { succeeded: phoneNumbers };
}
