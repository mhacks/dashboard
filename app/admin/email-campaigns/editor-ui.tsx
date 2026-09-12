"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export function InlineEditableField({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<"input"> & { wrapperClassName?: string }) {
  return (
    <div
      className={cn(
        "group/editable inline-flex max-w-full items-center gap-1",
        wrapperClassName,
      )}
    >
      <input
        className={cn(
          "min-w-[4ch] max-w-full border-0 border-b border-dotted border-transparent bg-transparent p-0 outline-none transition-[border-color] focus-visible:ring-0 placeholder:text-muted-foreground group-hover/editable:border-border/60 group-focus-within/editable:border-border/60 [field-sizing:content]",
          className,
        )}
        {...props}
      />
      <Pencil
        className="size-3 shrink-0 text-muted-foreground/35 transition-opacity group-hover/editable:text-muted-foreground/55 group-focus-within/editable:text-muted-foreground/55"
        aria-hidden
      />
    </div>
  );
}

export function EditorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          children ? "mb-3" : null,
        )}
      >
        <h3 className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children ? <div className="space-y-3">{children}</div> : null}
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
