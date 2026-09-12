"use client";

import { Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EmailTemplateType } from "@/lib/email/types";
import { cn } from "@/lib/utils";

export function AiDraftPanel({
  draftText,
  templateType,
  aiDescription,
  generateBusy,
  onAiDescriptionChange,
  onCopyAiContext,
  onDraftTextChange,
  onGenerateDraft,
  onImportDraft,
}: {
  draftText: string;
  templateType: EmailTemplateType;
  aiDescription: string;
  generateBusy: boolean;
  onAiDescriptionChange: (value: string) => void;
  onCopyAiContext: () => void;
  onDraftTextChange: (value: string) => void;
  onGenerateDraft: () => void;
  onImportDraft: () => void;
}) {
  const draftPlaceholder =
    templateType === "html"
      ? '{ "subject": "...", "previewText": "...", "html": "<p>...</p>" }'
      : '{ "subject": "...", "previewText": "...", "content": { "heading": "...", "sections": [...] } }';

  return (
    <div>
      <AiDraftStep
        step={1}
        title="Create a draft"
        description="Describe the email, then generate here or copy context for your own agent."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={generateBusy}
              onClick={onCopyAiContext}
            >
              <Copy />
              Copy for agent
            </Button>
            <Button
              type="button"
              disabled={generateBusy || !aiDescription.trim()}
              onClick={onGenerateDraft}
            >
              {generateBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles />
              )}
              {generateBusy ? "Generating…" : "Generate"}
            </Button>
          </>
        }
      >
        <Textarea
          rows={4}
          value={aiDescription}
          disabled={generateBusy}
          onChange={(event) => onAiDescriptionChange(event.target.value)}
          placeholder="RSVP reminder for accepted hackers. Friendly tone, Friday deadline."
        />
      </AiDraftStep>

      <AiDraftStep
        step={2}
        title="Import JSON"
        description="Paste the draft JSON below and apply it to this template."
        divided
        actions={
          <Button
            type="button"
            disabled={generateBusy || !draftText.trim()}
            onClick={onImportDraft}
          >
            Import
          </Button>
        }
      >
        <div className="relative">
          {generateBusy ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border border-border bg-background/85">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Generating draft…
              </div>
            </div>
          ) : null}
          <Textarea
            className="font-mono text-xs"
            rows={4}
            value={draftText}
            disabled={generateBusy}
            onChange={(event) => onDraftTextChange(event.target.value)}
            placeholder={draftPlaceholder}
          />
        </div>
      </AiDraftStep>
    </div>
  );
}

export function AiDraftStep({
  step,
  title,
  description,
  divided = false,
  actions,
  children,
}: {
  step: number;
  title: string;
  description: string;
  divided?: boolean;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("space-y-3", divided && "mt-6 border-t border-border pt-6")}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{step}.</span> {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
      </div>
    </section>
  );
}
