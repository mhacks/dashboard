"use client";

import { Input } from "@/components/ui/input";
import type { EmailThemeTokens } from "@/lib/email/types";
import { EditorSection, Field } from "./editor-ui";

export function StylesPanel({
  theme,
  onThemeChange,
}: {
  theme: EmailThemeTokens;
  onThemeChange: (theme: EmailThemeTokens) => void;
}) {
  const colorFields: Array<[keyof EmailThemeTokens, string]> = [
    ["background", "Background"],
    ["backgroundAccent", "Accent"],
    ["border", "Border"],
    ["text", "Text"],
    ["muted", "Muted"],
    ["panel", "Panel"],
    ["pink", "Pink"],
    ["green", "Green"],
    ["ctaBackground", "CTA bg"],
    ["ctaColor", "CTA text"],
  ];
  const sizeFields: Array<[keyof EmailThemeTokens, string]> = [
    ["containerRadius", "Container radius"],
    ["containerBorderWidth", "Border width"],
    ["containerPadding", "Container padding"],
    ["headingSize", "Heading size"],
    ["bodySize", "Body size"],
    ["ctaRadius", "CTA radius"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Styles</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Theme tokens used by structured emails.
        </p>
      </div>

      <EditorSection title="Colors">
        <div className="grid gap-3 sm:grid-cols-2">
          {colorFields.map(([key, label]) => (
            <label key={key} className="flex items-center gap-3">
              <span
                className="relative size-9 shrink-0 overflow-hidden rounded-md border border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50"
                style={{ backgroundColor: String(theme[key]) }}
              >
                <input
                  type="color"
                  value={String(theme[key])}
                  onChange={(event) =>
                    onThemeChange({ ...theme, [key]: event.target.value })
                  }
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted-foreground">
                  {label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {String(theme[key])}
                </span>
              </span>
            </label>
          ))}
        </div>
      </EditorSection>

      <EditorSection title="Sizes">
        <div className="grid gap-3 sm:grid-cols-2">
          {sizeFields.map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                value={String(theme[key])}
                onChange={(event) =>
                  onThemeChange({ ...theme, [key]: event.target.value })
                }
              />
            </Field>
          ))}
        </div>
      </EditorSection>
    </div>
  );
}
