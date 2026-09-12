import { z } from "zod";
import {
  defaultEmailMergeSamples,
  emailContentStrings,
  extractMergeFieldsFromValues,
} from "@/lib/email/merge-fields";
import type { MasterTemplate } from "@/lib/email/templates/master-service";
import {
  emailCampaignContentSchema,
  emailTemplateUpsertSchema,
  type EmailCampaignContent,
  type EmailThemeTokens,
} from "@/lib/email/types";
import { saveEmailTemplateAction } from "./actions";
import type { DirectSendStatus, TestSendProof } from "./campaign-types";

export async function persistTemplate(template: MasterTemplate) {
  const payload = {
    name: template.name,
    type: template.type,
    description: template.description,
    subject: template.subject,
    previewText: template.previewText,
    content: template.content ?? undefined,
    html: template.html ?? undefined,
    status: template.status,
    sourceTemplateId: template.sourceTemplateId,
  };

  return saveEmailTemplateAction({
    templateId: isDraftTemplateId(template.id) ? undefined : template.id,
    template: payload,
  });
}

export function isDraftTemplateId(templateId: string) {
  return templateId.startsWith("seed-") || isLocalDraftTemplateId(templateId);
}

export function isLocalDraftTemplateId(templateId: string) {
  return templateId.startsWith("local-");
}

export function parseAiTemplateDraft(
  rawDraft: string,
  template: MasterTemplate,
  currentMergeFields: string[],
): Partial<MasterTemplate> {
  const parsed = parseJsonObject(rawDraft);
  const draft = isRecord(parsed.template) ? parsed.template : parsed;
  const allowedMergeFields = new Set([
    ...Object.keys(defaultEmailMergeSamples),
    ...currentMergeFields,
  ]);
  const next: Partial<MasterTemplate> = {};
  const upsertFields = emailTemplateUpsertSchema.shape;

  if (hasString(draft, "name") && draft.name.trim()) {
    next.name = parseWithSchema(upsertFields.name, draft.name.trim());
  }

  if (hasString(draft, "description")) {
    next.description = parseWithSchema(
      upsertFields.description,
      draft.description.trim(),
    );
  }

  if (hasString(draft, "subject")) {
    next.subject = parseWithSchema(upsertFields.subject, draft.subject.trim());
  }

  if (hasString(draft, "previewText")) {
    next.previewText = parseWithSchema(
      upsertFields.previewText,
      draft.previewText.trim(),
    );
  }

  if (template.type === "html") {
    if (!hasString(draft, "html")) {
      throw new Error("AI draft must include html for this template.");
    }

    const html = parseWithSchema(upsertFields.html, draft.html);
    if (!html) {
      throw new Error("AI draft must include html for this template.");
    }
    assertSafeHtml(html);
    assertAllowedMergeFields([html], allowedMergeFields);
    next.html = html;
    next.content = null;
    return next;
  }

  if (!isRecord(draft.content)) {
    throw new Error("AI draft must include content for this template.");
  }

  next.content = parseAiContentDraft(draft.content, allowedMergeFields);
  next.html = null;
  return next;
}

export function parseJsonObject(rawDraft: string): Record<string, unknown> {
  const trimmed = rawDraft.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Paste a JSON object from the AI draft.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    throw new Error("AI draft JSON could not be parsed.");
  }

  if (!isRecord(parsed)) {
    throw new Error("AI draft must be a JSON object.");
  }

  return parsed;
}

export function parseAiContentDraft(
  draft: Record<string, unknown>,
  allowedMergeFields: Set<string>,
): EmailCampaignContent {
  const sections = Array.isArray(draft.sections)
    ? draft.sections.map((section) => {
        if (!isRecord(section)) {
          return section;
        }

        return {
          ...section,
          id: hasString(section, "id") ? section.id : crypto.randomUUID(),
          kind:
            section.kind === "code" || section.kind === "text"
              ? section.kind
              : undefined,
        };
      })
    : draft.sections;

  const cta = isRecord(draft.cta)
    ? {
        ...draft.cta,
        url: hasString(draft.cta, "url")
          ? normalizeDraftUrl(draft.cta.url)
          : draft.cta.url,
      }
    : undefined;

  const content = parseWithSchema(emailCampaignContentSchema, {
    ...draft,
    sections,
    cta,
  });
  assertAllowedMergeFields(emailContentStrings(content), allowedMergeFields);
  return content;
}

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || "Invalid AI draft.");
  }
  return result.data;
}

export function assertAllowedMergeFields(
  values: string[],
  allowedMergeFields: Set<string>,
) {
  const fields = extractMergeFieldsFromValues(values);
  const unknown = fields.filter((field) => !allowedMergeFields.has(field));

  if (unknown.length > 0) {
    throw new Error(`Unknown merge fields: ${unknown.join(", ")}`);
  }
}

export function assertSafeHtml(html: string) {
  if (/<script\b/i.test(html) || /\son\w+=/i.test(html)) {
    throw new Error("HTML drafts cannot include scripts or event handlers.");
  }

  if (/javascript:/i.test(html)) {
    throw new Error("HTML drafts cannot include javascript URLs.");
  }
}

export function normalizeDraftUrl(value: string) {
  const markdownLink = value.match(/^\[[^\]]+]\(([^)]+)\)$/);
  return markdownLink ? markdownLink[1].trim() : value;
}

export function hasString(
  value: Record<string, unknown>,
  key: string,
): value is Record<string, unknown> & Record<typeof key, string> {
  return typeof value[key] === "string";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ensureMergePreviewData(
  fields: string[],
  current: Record<string, string>,
) {
  const next: Record<string, string> = {};

  for (const field of fields) {
    next[field] = current[field] ?? defaultMergeValue(field);
  }

  return next;
}

export function defaultMergeValue(field: string) {
  return (
    defaultEmailMergeSamples[field] ?? `Sample ${field.replaceAll("_", " ")}`
  );
}

export function buildDirectSendTemplate(
  template: MasterTemplate | null,
  theme: EmailThemeTokens,
) {
  if (!template) {
    return null;
  }

  if (template.type === "html") {
    if (!template.html) {
      return null;
    }

    return {
      type: "html" as const,
      subject: template.subject,
      previewText: template.previewText,
      html: template.html,
    };
  }

  if (!template.content) {
    return null;
  }

  return {
    type: "structured" as const,
    templateId: template.sourceTemplateId,
    subject: template.subject,
    previewText: template.previewText,
    content: template.content,
    theme,
  };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function buildTestSendProofKey(
  template: MasterTemplate | null,
  theme: EmailThemeTokens,
) {
  if (!template) {
    return "no-template";
  }

  return JSON.stringify({
    templateId: template.id,
    type: template.type,
    subject: template.subject,
    previewText: template.previewText,
    content: template.content,
    html: template.html,
    theme,
  });
}

export function delayUntil(timestamp: string, extraMs = 0) {
  return Math.max(0, Date.parse(timestamp) - Date.now() + extraMs);
}

export function mergeSendFailures(
  current: DirectSendStatus["recentFailures"],
  incoming: DirectSendStatus["recentFailures"],
) {
  const seen = new Set(
    current.map((failure) => `${failure.email}\0${failure.error ?? ""}`),
  );
  const merged = [...current];

  for (const failure of incoming) {
    const key = `${failure.email}\0${failure.error ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(failure);
  }

  return merged;
}

export function freshTestSendProof(
  proof: TestSendProof | null,
  proofKey: string,
) {
  if (
    !proof ||
    proof.proofKey !== proofKey ||
    Date.parse(proof.expiresAt) <= Date.now()
  ) {
    return null;
  }

  return proof;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "email-template"
  );
}

export function downloadTextFile({
  filename,
  mimeType,
  content,
}: {
  filename: string;
  mimeType: string;
  content: string;
}) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
