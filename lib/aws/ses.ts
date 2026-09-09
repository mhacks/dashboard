import {
  ListContactsCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
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
const UNSUBSCRIBED_CACHE_MS = 60_000;

let transporter: Transporter | undefined;
let contactsClient: SESv2Client | undefined;
let unsubscribedCache: { fetchedAt: number; emails: Set<string> } | undefined;

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

  const sesClient = new SESv2Client({
    region: SES_REGION,
    credentials: requireSesCredentials(),
  });

  const sesOptions: SESTransport.Options = {
    SES: { sesClient, SendEmailCommand },
  };

  transporter = nodemailer.createTransport(sesOptions);
  return transporter;
}

// AWS_SES_SMTP_USER holds the IAM access key id in the deployed task
// definition: SES labels that value the "SMTP username" in its console.
function sesCredentials() {
  const accessKeyId =
    process.env.AWS_SES_ACCESS_KEY_ID ??
    process.env.AWS_SES_SMTP_USER ??
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_SES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

  return accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey }
    : undefined;
}

function requireSesCredentials() {
  const credentials = sesCredentials();

  if (!credentials) {
    throw new Error(
      "SES credentials are not configured. Set AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY.",
    );
  }

  return credentials;
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

// Best-effort pre-filter so a campaign does not hand SES addresses it will
// refuse. SES still enforces the opt-out itself (it bounces mail addressed to
// an unsubscribed contact), so a miss here costs a bounce, never a wrong
// delivery — that is why every failure path below degrades to "nobody is
// unsubscribed" rather than blocking the send.
export async function listUnsubscribedContacts(): Promise<Set<string>> {
  if (process.env.NODE_ENV === "development" || !sesCredentials()) {
    return new Set();
  }

  const cached = unsubscribedCache;
  if (cached && Date.now() - cached.fetchedAt < UNSUBSCRIBED_CACHE_MS) {
    return cached.emails;
  }

  try {
    const emails = new Set<string>();
    let nextToken: string | undefined;

    do {
      // PageSize is deliberately unset: SES documents no maximum for it, and a
      // value it rejects would fail every lookup into the silent-fallback path
      // below. NextToken paginates correctly at whatever default SES picks.
      const page = await getContactsClient().send(
        new ListContactsCommand({
          ContactListName: SES_CONTACT_LIST,
          Filter: {
            FilteredStatus: "OPT_OUT",
            TopicFilter: {
              TopicName: SES_CONTACT_TOPIC,
              UseDefaultIfPreferenceUnavailable: false,
            },
          },
          NextToken: nextToken,
        }),
      );

      for (const contact of page.Contacts ?? []) {
        if (contact.EmailAddress) {
          emails.add(contact.EmailAddress.trim().toLowerCase());
        }
      }

      nextToken = page.NextToken;
    } while (nextToken);

    unsubscribedCache = { fetchedAt: Date.now(), emails };
    return emails;
  } catch (error) {
    // A missing contact list, a throttle, or a denied ses:ListContacts must not
    // take a campaign down. Fall through and let SES apply the opt-out. The
    // empty result is cached like any other so one broken lookup does not
    // re-hit SES — and re-log — on every batch of a long send.
    console.error(
      "Could not read SES unsubscribes; sending unfiltered.",
      error,
    );
    unsubscribedCache = { fetchedAt: Date.now(), emails: new Set() };
    return unsubscribedCache.emails;
  }
}

function getContactsClient(): SESv2Client {
  if (!contactsClient) {
    contactsClient = new SESv2Client({
      region: SES_REGION,
      credentials: requireSesCredentials(),
    });
  }

  return contactsClient;
}
