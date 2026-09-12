"use client";

import {
  ArrowDown,
  ArrowUp,
  Download,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MasterTemplate } from "@/lib/email/templates/master-service";
import type { EmailCampaignContent } from "@/lib/email/types";
import { EditorSection, Field, InlineEditableField } from "./editor-ui";

export function BodyBlockCard({
  index,
  total,
  section,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  section: EmailCampaignContent["sections"][number];
  onChange: (patch: Partial<EmailCampaignContent["sections"][number]>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const blockLabel = section.title?.trim() || `Block ${index + 1}`;

  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <InlineEditableField
          className="text-sm font-medium text-foreground"
          wrapperClassName="min-w-0 flex-1"
          value={section.title ?? ""}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder={`Block ${index + 1}`}
          aria-label={`Title for block ${index + 1}`}
        />
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move ${blockLabel} up`}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Move ${blockLabel} down`}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onRemove}
            aria-label={`Remove ${blockLabel}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <Textarea
        className="mt-3"
        rows={6}
        value={section.body}
        onChange={(event) => onChange({ body: event.target.value })}
        placeholder="Body copy"
        aria-label={`Body copy for ${blockLabel}`}
      />
    </div>
  );
}

export function BuilderPanel({
  notice,
  selectedTemplate,
  onDownloadTemplate,
  onOpenAiDraft,
  onTemplateChange,
  onContentChange,
  onSectionChange,
  onSectionAdd,
  onSectionRemove,
  onSectionMove,
}: {
  notice: string;
  selectedTemplate: MasterTemplate | null;
  onDownloadTemplate: () => void;
  onOpenAiDraft: () => void;
  onTemplateChange: (patch: Partial<MasterTemplate>) => void;
  onContentChange: (patch: Partial<EmailCampaignContent>) => void;
  onSectionChange: (
    index: number,
    patch: Partial<EmailCampaignContent["sections"][number]>,
  ) => void;
  onSectionAdd: () => void;
  onSectionRemove: (index: number) => void;
  onSectionMove: (index: number, direction: -1 | 1) => void;
}) {
  if (!selectedTemplate) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground">
        Choose or create a master template.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <InlineEditableField
            className="text-lg font-semibold text-foreground"
            wrapperClassName="min-w-0 flex-1"
            value={selectedTemplate.name}
            onChange={(event) => onTemplateChange({ name: event.target.value })}
            placeholder="Template name"
            aria-label="Template name"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onOpenAiDraft}
            aria-label="AI drafting"
          >
            <Sparkles />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onDownloadTemplate}
            aria-label="Download template"
          >
            <Download />
          </Button>
        </div>
        <InlineEditableField
          className="text-sm text-muted-foreground"
          wrapperClassName="mt-1.5 max-w-full"
          value={selectedTemplate.description}
          onChange={(event) =>
            onTemplateChange({ description: event.target.value })
          }
          placeholder="Description"
          aria-label="Description"
        />
      </div>

      {notice ? (
        <p className="text-sm text-muted-foreground">{notice}</p>
      ) : null}

      <div className="space-y-3">
        <Field label="Subject">
          <Input
            value={selectedTemplate.subject}
            onChange={(event) =>
              onTemplateChange({ subject: event.target.value })
            }
          />
        </Field>
        <Field label="Preview text">
          <Input
            value={selectedTemplate.previewText}
            onChange={(event) =>
              onTemplateChange({ previewText: event.target.value })
            }
          />
        </Field>
      </div>

      {selectedTemplate.type === "html" ? (
        <EditorSection title="HTML body">
          <Textarea
            className="text-xs"
            rows={18}
            value={selectedTemplate.html ?? ""}
            onChange={(event) => onTemplateChange({ html: event.target.value })}
          />
        </EditorSection>
      ) : selectedTemplate.content ? (
        <>
          <EditorSection title="Header">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Eyebrow">
                <Input
                  value={selectedTemplate.content.eyebrow ?? ""}
                  onChange={(event) =>
                    onContentChange({ eyebrow: event.target.value })
                  }
                />
              </Field>
              <Field label="Heading">
                <Input
                  value={selectedTemplate.content.heading}
                  onChange={(event) =>
                    onContentChange({ heading: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Intro">
              <Textarea
                rows={2}
                value={selectedTemplate.content.intro ?? ""}
                onChange={(event) =>
                  onContentChange({ intro: event.target.value })
                }
              />
            </Field>
          </EditorSection>

          <EditorSection
            title="Body blocks"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSectionAdd}
              >
                <Plus />
                Add block
              </Button>
            }
          >
            {selectedTemplate.content.sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No body blocks yet.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedTemplate.content.sections.map((section, index) => (
                  <BodyBlockCard
                    key={section.id}
                    index={index}
                    total={selectedTemplate.content!.sections.length}
                    section={section}
                    onChange={(patch) => onSectionChange(index, patch)}
                    onMove={(direction) => onSectionMove(index, direction)}
                    onRemove={() => onSectionRemove(index)}
                  />
                ))}
              </div>
            )}
          </EditorSection>

          <EditorSection title="Footer">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Button label">
                <Input
                  value={selectedTemplate.content.cta?.label ?? ""}
                  onChange={(event) =>
                    onContentChange({
                      cta: {
                        label: event.target.value,
                        url:
                          selectedTemplate.content?.cta?.url ??
                          "https://mhacks.org",
                      },
                    })
                  }
                  placeholder="Open dashboard"
                />
              </Field>
              <Field label="Button URL">
                <Input
                  value={selectedTemplate.content.cta?.url ?? ""}
                  onChange={(event) =>
                    onContentChange({
                      cta: {
                        label:
                          selectedTemplate.content?.cta?.label ?? "Learn more",
                        url: event.target.value,
                      },
                    })
                  }
                  placeholder="https://mhacks.org"
                />
              </Field>
            </div>
            <Field label="Footer note">
              <Textarea
                rows={2}
                value={selectedTemplate.content.footerNote ?? ""}
                onChange={(event) =>
                  onContentChange({ footerNote: event.target.value })
                }
                placeholder="Questions? Reply to this email or contact the MHacks team."
              />
            </Field>
          </EditorSection>
        </>
      ) : null}
    </div>
  );
}
