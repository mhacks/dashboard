"use server";

import { redirect } from "next/navigation";

export async function broadcastEmail(formData: FormData) {
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  send_all_email_stub(subject, body);
  log_broadcast_stub("email", body, subject);
  redirect("/broadcast_hackers/success?channel=email");
}

export async function broadcastSms(formData: FormData) {
  const message = formData.get("message") as string;
  send_all_sms_stub(message);
  log_broadcast_stub("sms", message);
  redirect("/broadcast_hackers/success?channel=sms");
}

function send_all_email_stub(subject: string, body: string) {
  console.log("[EMAIL STUB] subject:", subject);
  console.log("[EMAIL STUB] body:", body);
}

function send_all_sms_stub(message: string) {
  console.log("[SMS STUB] message:", message);
}

function log_broadcast_stub(channel: "email" | "sms", body: string, subject?: string) {
  console.log("[BROADCAST LOG STUB] channel:", channel, "subject:", subject, "body:", body);
}
