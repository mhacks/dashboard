import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS!;

const credentials = {
  accessKeyId: process.env.SES_ACCESS_KEY_ID!,
  secretAccessKey: process.env.SES_SECRET_ACCESS_KEY!,
};

const client = new SESClient({
  region: process.env.SES_REGION ?? "us-east-2",
  credentials,
});

export async function sendBulkEmail(
  emails: string[],
  subject: string,
  body: string,
): Promise<{ succeeded: string[] }> {
  const results = await Promise.allSettled(
    emails.map((email) =>
      client.send(
        new SendEmailCommand({
          Source: SES_FROM_ADDRESS,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: body } },
          },
        }),
      ),
    ),
  );
  const succeeded = emails.filter((_, i) => results[i].status === "fulfilled");
  return { succeeded };
}
