import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "hackathon@mhacks.org";
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "MHacks Team";

function getSesClient() {
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;

  return new SESClient({
    region: process.env.SES_REGION ?? "us-east-2",
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const client = getSesClient();
  if (!client) return false;

  await client.send(
    new SendEmailCommand({
      Source: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  );

  return true;
}
