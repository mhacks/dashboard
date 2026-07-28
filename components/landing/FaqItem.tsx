"use client";

import { motion } from "framer-motion";

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
  open: boolean;
}

export function FaqItem({ value, q, a, open }: Props) {
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
        <motion.span
          animate={{
            rotate: open ? 45 : 0,
            backgroundColor: open ? "#3A4A26" : "transparent",
            color: open ? "#EFE9D4" : "#5D6B3A",
          }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border font-mono text-[14px]"
        >
          +
        </motion.span>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6 text-[15px] leading-[1.6] text-[#3d4730]">
        {a}
      </AccordionContent>
    </AccordionItem>
  );
}
