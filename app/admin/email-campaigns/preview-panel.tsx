"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { defaultMergeValue } from "./campaign-helpers";

export function PreviewMergePanel({
  fields,
  values,
  onChange,
}: {
  fields: string[];
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
}) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <Accordion type="single" collapsible className="mt-3">
      <AccordionItem
        value="merge"
        className="overflow-hidden rounded-lg border border-border bg-card"
      >
        <AccordionTrigger className="items-center px-3 py-2 text-sm font-medium hover:no-underline">
          <span className="flex min-w-0 items-center gap-2">
            Sample recipient
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
              {fields.length}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-0 pb-0">
          <ul className="divide-y divide-border/70 border-t border-border/70">
            {fields.map((field) => (
              <li key={field}>
                <label className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/40">
                  <code className="w-36 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                    {`{{${field}}}`}
                  </code>
                  <Input
                    aria-label={`Sample value for ${field}`}
                    className="min-w-0 flex-1"
                    value={values[field] ?? ""}
                    placeholder={defaultMergeValue(field)}
                    onChange={(event) => onChange(field, event.target.value)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function PreviewButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex size-6 items-center justify-center rounded-pill border border-transparent transition-colors [&_svg]:size-3.5 ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
