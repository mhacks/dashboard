"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  q: string;
  a: string;
}

export function FaqItem({ value, q, a }: Props) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-md border border-border bg-white not-last:border-b-0"
    >
      <AccordionTrigger
        className={cn(
          "group flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[17px] font-medium text-ink hover:no-underline",
          "[&_[data-slot=accordion-trigger-icon]]:hidden",
        )}
        data-cursor="hover"
      >
        <span>{q}</span>
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border font-mono text-[14px] text-[#5D6B3A]",
            "transition-[transform,background-color,color] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            "group-aria-expanded/accordion-trigger:rotate-45 group-aria-expanded/accordion-trigger:bg-[#3A4A26] group-aria-expanded/accordion-trigger:text-[#EFE9D4]",
          )}
        >
          +
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6 text-[15px] leading-[1.6] text-[#3d4730]">
        {a}
      </AccordionContent>
    </AccordionItem>
  );
}
