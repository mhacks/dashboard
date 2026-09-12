import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { EmailCampaignError } from "@/lib/email/campaigns/config";
import { buildAiTemplateContext } from "@/lib/email/campaigns/ai-draft-context";
import {
  createChatCompletion,
  openRouterFreeModel,
  OpenRouterError,
} from "@/lib/openrouter/client";
import {
  emailCampaignContentSchema,
  emailTemplateTypeSchema,
} from "@/lib/email/types";

const generateEmailTemplateDraftSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  template: z.object({
    name: z.string(),
    type: emailTemplateTypeSchema,
    description: z.string(),
    subject: z.string(),
    previewText: z.string(),
    content: emailCampaignContentSchema.nullable(),
    html: z.string().nullable(),
  }),
  mergeFields: z.array(z.string()).default([]),
});

export async function generateEmailTemplateDraft(input: unknown) {
  await requireOrganizer();
  const body = generateEmailTemplateDraftSchema.parse(input);
  const systemPrompt = buildAiTemplateContext(body.template, body.mergeFields);

  try {
    const completion = await createChatCompletion({
      model: openRouterFreeModel,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            "Generate an email template based on this description:",
            "",
            body.description,
            "",
            "Return ONLY valid JSON matching the expected shape.",
          ].join("\n"),
        },
      ],
    });

    return {
      draftText: completion.content,
      model: completion.model,
    };
  } catch (error) {
    if (error instanceof OpenRouterError) {
      throw new EmailCampaignError(error.message, error.status ?? 502);
    }

    throw error;
  }
}
