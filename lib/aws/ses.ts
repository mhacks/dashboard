import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer, { type Transporter } from "nodemailer";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "hackathon@mhacks.org";
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "MHacks Team";

let transporter: Transporter | null | undefined;

function createTransporter(): Transporter | null {
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 54325),
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;

  const sesClient = new SESv2Client({
    region: process.env.SES_REGION ?? "us-east-2",
    credentials: { accessKeyId, secretAccessKey },
  });

  return nodemailer.createTransport({
    SES: { sesClient, SendEmailCommand },
  });
}

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = createTransporter();
  }
  return transporter;
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
  const mailTransporter = getTransporter();
  if (!mailTransporter) return false;

  await mailTransporter.sendMail({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });

  return true;
}
