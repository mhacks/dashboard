import type { EmailCampaignContent } from "@/lib/email/types";

export const defaultEmailMergeSamples: Record<string, string> = {
  email: "hacker@mhacks.org",
  expires_in: "10 minutes",
  first_name: "Hacker",
  last_name: "Hacker",
  name: "Hacker",
  otp_code: "123456",
  travel_reimbursement: "150.00",
};

export function emailContentStrings(content: EmailCampaignContent) {
  return [
    content.eyebrow ?? "",
    content.heading,
    content.intro ?? "",
    content.cta?.label ?? "",
    content.cta?.url ?? "",
    content.footerNote ?? "",
    ...content.sections.flatMap((section) => [
      section.title ?? "",
      section.body,
    ]),
  ];
}

export function extractMergeFieldsFromValues(values: string[]) {
  const fields = new Set<string>();
  const pattern = /{{\s*([\w.-]+)\s*}}/g;

  for (const value of values) {
    for (const match of value.matchAll(pattern)) {
      fields.add(match[1]);
    }
  }

  return Array.from(fields).sort((a, b) => a.localeCompare(b));
}

export function extractEmailMergeFields(template: {
  subject: string;
  previewText: string;
  html?: string | null;
  content?: EmailCampaignContent | null;
}) {
  return extractMergeFieldsFromValues([
    template.subject,
    template.previewText,
    template.html ?? "",
    ...(template.content ? emailContentStrings(template.content) : []),
  ]);
}
