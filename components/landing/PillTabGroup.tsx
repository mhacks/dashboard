"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: TabOption<T>[];
  ariaLabel: string;
  variant?: "spread" | "segmented";
  className?: string;
}

const triggerBase =
  "font-mono uppercase tracking-[0.15em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-700";

/** Accessible pill tabs styled for the marketing site. */
export function PillTabGroup<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  variant = "spread",
  className,
}: Props<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={className}
    >
      <TabsList
        aria-label={ariaLabel}
        className={cn(
          "h-auto bg-transparent p-0 shadow-none",
          variant === "spread"
            ? "flex flex-wrap gap-2"
            : "inline-flex rounded-pill border border-[rgba(29,36,18,0.14)] bg-[rgba(251,250,244,0.85)] p-1 shadow-e-2 backdrop-blur-md",
        )}
      >
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            data-cursor="hover"
            className={cn(
              triggerBase,
              "rounded-pill border shadow-none after:hidden data-active:shadow-none",
              variant === "spread"
                ? "px-4 py-1.5 text-[12px] border-[rgba(29,36,18,0.25)] text-moss-700/80 hover:border-moss-700 data-active:border-moss-700 data-active:bg-moss-700 data-active:text-cream"
                : "px-3.5 py-1 text-[11px] border-transparent text-moss-700/70 hover:text-moss-700 data-active:bg-moss-700 data-active:text-cream",
            )}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
