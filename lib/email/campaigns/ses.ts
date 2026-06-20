import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { EmailCampaignError } from "@/lib/email/campaigns/config";

let sesClient: SESClient | null = null;
const sesRequestTimeoutMs = 15_000;

export interface SendRenderedEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendRenderedEmail({
  to,
  subject,
  html,
  text,
}: SendRenderedEmailInput) {
  const client = getSesClient();
  const fromEmail = process.env.SES_FROM_EMAIL;
  const fromName = process.env.SES_FROM_NAME || "MHacks Team";

  if (!fromEmail) {
    throw new EmailCampaignError("SES_FROM_EMAIL is not configured", 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sesRequestTimeoutMs);

  try {
    const result = await client.send(
      new SendEmailCommand({
        Source: `${fromName} <${fromEmail}>`,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Charset: "UTF-8",
            Data: subject,
          },
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: html,
            },
            Text: {
              Charset: "UTF-8",
              Data: text,
            },
          },
        },
      }),
      { abortSignal: controller.signal },
    );

    return result.MessageId ?? null;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new EmailCampaignError("SES request timed out", 504);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function sanitizeSesError(error: unknown) {
  if (error instanceof EmailCampaignError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown SES error";
}

function getSesClient() {
  if (sesClient) {
    return sesClient;
  }

  const region = process.env.AWS_SES_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new EmailCampaignError("SES credentials are not configured", 500);
  }

  sesClient = new SESClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return sesClient;
}
