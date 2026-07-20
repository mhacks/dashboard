import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  SES_FROM_ADDRESS,
} from "./config";

const client = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export async function sendBulkEmail(
  emails: string[],
  subject: string,
  body: string
): Promise<void> {
  await Promise.allSettled(
    emails.map((email) =>
      client.send(
        new SendEmailCommand({
          Source: SES_FROM_ADDRESS,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: body } },
          },
        })
      )
    )
  );
}
