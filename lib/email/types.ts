import { z } from "zod";

const maxRecipientTextLength = 300_000;
const maxHtmlTemplateLength = 500_000;
const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: "URL must use http or https" },
  );

export const emailBodySectionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["text", "code"]).optional(),
  title: z.string().optional(),
  body: z.string().min(1),
});

export const emailCtaSchema = z.object({
  label: z.string().min(1),
  url: httpUrlSchema,
});

export const emailCampaignContentSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  intro: z.string().optional(),
  sections: z.array(emailBodySectionSchema).min(1),
  cta: emailCtaSchema.optional(),
  footerNote: z.string().optional(),
});

export const emailThemeTokensSchema = z.object({
  background: z.string().min(1),
  backgroundAccent: z.string().min(1),
  border: z.string().min(1),
  text: z.string().min(1),
  muted: z.string().min(1),
  panel: z.string().min(1),
  white: z.string().min(1),
  pink: z.string().min(1),
  cyan: z.string().min(1),
  yellow: z.string().min(1),
  green: z.string().min(1),
  containerRadius: z.string().min(1),
  containerBorderWidth: z.string().min(1),
  containerPadding: z.string().min(1),
  headingSize: z.string().min(1),
  bodySize: z.string().min(1),
  ctaRadius: z.string().min(1),
  ctaBackground: z.string().min(1),
  ctaColor: z.string().min(1),
  fontFamily: z.string().min(1),
});

export const emailTemplateTypeSchema = z.enum(["structured", "html"]);

export const emailTemplateUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  type: emailTemplateTypeSchema,
  description: z.string().max(240).default(""),
  subject: z.string().min(1).max(180),
  previewText: z.string().max(220).default(""),
  content: emailCampaignContentSchema.optional(),
  html: z.string().max(maxHtmlTemplateLength).optional(),
  status: z.string().default("active"),
  sourceTemplateId: z.string().min(1).default("mhacks-announcement"),
});

export const htmlTemplateUploadSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(240).default(""),
  subject: z.string().min(1).max(180),
  previewText: z.string().max(220).default(""),
  html: z.string().min(1).max(maxHtmlTemplateLength),
});

const mergeDataSchema = z.record(z.string(), z.string()).optional();

export const emailRenderPreviewSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("structured"),
    templateId: z.string().default("mhacks-announcement"),
    subject: z.string().min(1),
    previewText: z.string().default(""),
    content: emailCampaignContentSchema,
    theme: emailThemeTokensSchema.optional(),
    mergeData: mergeDataSchema,
  }),
  z.object({
    type: z.literal("html"),
    subject: z.string().min(1),
    previewText: z.string().default(""),
    html: z.string().min(1).max(maxHtmlTemplateLength),
    mergeData: mergeDataSchema,
  }),
]);

export const campaignUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  templateId: z.string().min(1),
  subject: z.string().min(1).max(180),
  previewText: z.string().max(220).default(""),
  content: emailCampaignContentSchema,
  templateSnapshot: z.unknown().optional(),
  themeSnapshot: emailThemeTokensSchema.optional(),
});

export const recipientTextSchema = z.object({
  recipients: z.string().default(""),
});

export const directEmailTemplateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("structured"),
    templateId: z.string().default("mhacks-announcement"),
    subject: z.string().min(1),
    previewText: z.string().default(""),
    content: emailCampaignContentSchema,
    theme: emailThemeTokensSchema.optional(),
  }),
  z.object({
    type: z.literal("html"),
    subject: z.string().min(1),
    previewText: z.string().default(""),
    html: z.string().min(1).max(maxHtmlTemplateLength),
  }),
]);

export const directRecipientParseSchema = z.object({
  recipients: z.string().max(maxRecipientTextLength).default(""),
});

export const directSendOneSchema = z.object({
  template: directEmailTemplateSchema,
  email: z.string().email(),
  mergeData: z.record(z.string(), z.string()).optional(),
});

export const directTestSendSchema = z.object({
  template: directEmailTemplateSchema,
  emails: z.array(z.string().email()).max(20).default([]),
  mergeData: z.record(z.string(), z.string()).optional(),
});

export const directBatchSendSchema = z.object({
  campaignId: z.string().uuid().optional(),
  template: directEmailTemplateSchema,
  recipients: z.string().max(maxRecipientTextLength).default(""),
  testSendToken: z.string().uuid().optional(),
  cursor: z.number().int().min(0).default(0),
  sentCount: z.number().int().min(0).default(0),
  failedCount: z.number().int().min(0).default(0),
  recentFailures: z
    .array(
      z.object({
        email: z.string(),
        error: z.string().nullable(),
      }),
    )
    .default([]),
});

export type EmailCampaignContent = z.infer<typeof emailCampaignContentSchema>;
export type EmailBodySection = z.infer<typeof emailBodySectionSchema>;
export type CampaignUpsertInput = z.infer<typeof campaignUpsertSchema>;
export type EmailThemeTokens = z.infer<typeof emailThemeTokensSchema>;
export type EmailTemplateUpsertInput = z.infer<
  typeof emailTemplateUpsertSchema
>;
export type EmailTemplateType = z.infer<typeof emailTemplateTypeSchema>;
export type DirectEmailTemplateInput = z.infer<
  typeof directEmailTemplateSchema
>;

export const defaultCampaignContent: EmailCampaignContent = {
  eyebrow: "MHacks Update",
  heading: "A new MHacks update",
  intro: "Hi there,",
  sections: [
    {
      id: "main",
      title: "What to know",
      body: "Use this section to share the most important campaign details with recipients.",
    },
  ],
  cta: {
    label: "Open dashboard",
    url: "https://mhacks.org",
  },
  footerNote: "Questions? Reply to this email or contact the MHacks team.",
};
