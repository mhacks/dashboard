"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export const stackedSheetClassName =
  "relative -mt-14 md:-mt-20 overflow-hidden rounded-t-[40px] md:rounded-t-[48px]";

/** Shared shell for stacked landing sections (rounded top, negative overlap). */
export const StackedSheet = forwardRef<
  HTMLElement,
  ComponentPropsWithoutRef<"section"> & { id: string }
>(function StackedSheet({ id, className, children, ...props }, ref) {
  return (
    <section
      ref={ref}
      id={id}
      className={cn(stackedSheetClassName, className)}
      {...props}
    >
      {children}
    </section>
  );
});
