import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer, { type Transporter } from "nodemailer";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "hackathon@mhacks.org";
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "MHacks Team";
const SES_REGION = process.env.SES_REGION ?? "us-east-2";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const accessKeyId = process.env.AWS_SES_SMTP_USER!;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY!;
  if (process.env.NODE_ENV !== "development") {
    const sesClient = new SESv2Client({
      region: SES_REGION,
      credentials: { accessKeyId, secretAccessKey },
    });

    transporter = nodemailer.createTransport({
      SES: { sesClient, SendEmailCommand },
    });
    return transporter;
  }

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 54325),
      secure: false,
      tls: { rejectUnauthorized: false },
    });
    return transporter;
  }

  transporter = null;
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
  const transporter = getTransporter();
  if (!transporter) return false;

  await transporter.sendMail({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });

  return true;
}
