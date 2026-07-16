import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  emailCampaignSender,
  EmailCampaignError,
} from "@/lib/email/campaigns/config";

let sesClient: SESClient | null = null;
const sesRegion = "us-east-2";
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sesRequestTimeoutMs);

  try {
    const result = await client.send(
      new SendEmailCommand({
        Source: `${emailCampaignSender.fromName} <${emailCampaignSender.fromEmail}>`,
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

  const accessKeyId =
    process.env.AWS_SES_ACCESS_KEY_ID ??
    process.env.AWS_SES_SMTP_USER ??
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_SES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new EmailCampaignError(
      "SES credentials are not configured. Set AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY, then restart the dev server.",
      500,
    );
  }

  sesClient = new SESClient({
    region: sesRegion,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return sesClient;
}
