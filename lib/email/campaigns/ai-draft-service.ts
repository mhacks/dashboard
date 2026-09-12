import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { EmailCampaignError } from "@/lib/email/campaigns/config";
import {
  aiDraftTemplateContextSchema,
  buildAiTemplateContext,
} from "@/lib/email/campaigns/ai-draft-context";
import {
  createChatCompletion,
  openRouterFreeModel,
  OpenRouterError,
} from "@/lib/openrouter/client";

const defaultMergeSamples: Record<string, string> = {
  email: "hacker@mhacks.org",
  expires_in: "10 minutes",
  first_name: "Hacker",
  last_name: "Hacker",
  name: "Hacker",
  otp_code: "123456",
  travel_reimbursement: "150.00",
};

const generateEmailTemplateDraftSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  template: aiDraftTemplateContextSchema,
  mergeFields: z.array(z.string()).default([]),
});

export async function generateEmailTemplateDraft(input: unknown) {
  await requireOrganizer();
  const body = generateEmailTemplateDraftSchema.parse(input);
  const systemPrompt = buildAiTemplateContext(
    body.template,
    body.mergeFields,
    defaultMergeSamples,
  );

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
