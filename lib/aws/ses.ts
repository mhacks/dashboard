import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer, { type Transporter } from "nodemailer";
import type SESTransport from "nodemailer/lib/ses-transport";
import type { EmailDeliveryType } from "@/lib/email/types";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "hackathon@mhacks.org";
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "MHacks Team";
const SES_REGION = process.env.SES_REGION ?? "us-east-2";
const SMTP_TIMEOUT_MS = 15_000;
const SES_CONTACT_LIST = process.env.SES_CONTACT_LIST ?? "mhacks";
const SES_CONTACT_TOPIC = process.env.SES_CONTACT_TOPIC ?? "event-updates";
const SES_UNSUBSCRIBE_URL = "{{amazonSESUnsubscribeUrl}}";
const LOCAL_UNSUBSCRIBE_URL = "https://example.invalid/unsubscribe";

let transporter: Transporter | undefined;

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
  deliveryType?: EmailDeliveryType;
};

export function managedUnsubscribeUrl() {
  return process.env.NODE_ENV === "development"
    ? LOCAL_UNSUBSCRIBE_URL
    : SES_UNSUBSCRIBE_URL;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (process.env.NODE_ENV === "development") {
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      throw new Error(
        "Email is not configured. Set SMTP_HOST for local email.",
      );
    }

    const smtpUser = process.env.AWS_SES_SMTP_USER;
    const smtpPassword = process.env.AWS_SES_SMTP_PASSWORD;

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 54325),
      secure: false,
      auth:
        smtpUser && smtpPassword
          ? { user: smtpUser, pass: smtpPassword }
          : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      tls: { rejectUnauthorized: false },
    });
    return transporter;
  }

  // AWS_SES_SMTP_USER holds the IAM access key id in the deployed task
  // definition: SES labels that value the "SMTP username" in its console.
  const accessKeyId =
    process.env.AWS_SES_ACCESS_KEY_ID ??
    process.env.AWS_SES_SMTP_USER ??
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_SES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "SES credentials are not configured. Set AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY.",
    );
  }

  const sesClient = new SESv2Client({
    region: SES_REGION,
    credentials: { accessKeyId, secretAccessKey },
  });

  const sesOptions: SESTransport.Options = {
    SES: { sesClient, SendEmailCommand },
  };

  transporter = nodemailer.createTransport(sesOptions);
  return transporter;
}

function localSmtpConfig() {
  return `${process.env.SMTP_HOST ?? "127.0.0.1"}:${process.env.SMTP_PORT ?? 54325}`;
}

function emailSendError(error: unknown) {
  if (
    process.env.NODE_ENV === "development" &&
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ESOCKET")
  ) {
    return new Error(
      `Local email SMTP is not reachable at ${localSmtpConfig()}. Start the Supabase local stack/Mailpit before sending email.`,
      { cause: error },
    );
  }

  return error instanceof Error ? error : new Error("Email failed to send.");
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  fromEmail = FROM_EMAIL,
  fromName = FROM_NAME,
  deliveryType = "transactional",
}: SendEmailInput) {
  try {
    const isSubscription = deliveryType === "subscription";
    const mailOptions: SESTransport.MailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      text,
      html,
      headers: isSubscription
        ? {
            "List-ID": `MHacks event updates <${SES_CONTACT_TOPIC}.mhacks.org>`,
          }
        : undefined,
      ses:
        isSubscription && process.env.NODE_ENV !== "development"
          ? {
              ListManagementOptions: {
                ContactListName: SES_CONTACT_LIST,
                TopicName: SES_CONTACT_TOPIC,
              },
            }
          : undefined,
    };
    const info = await getTransporter().sendMail(mailOptions);

    return typeof info.messageId === "string" ? info.messageId : null;
  } catch (error) {
    throw emailSendError(error);
  }
}
