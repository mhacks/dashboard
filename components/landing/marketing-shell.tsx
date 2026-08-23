"use client";

import { Cursor } from "@/components/landing/Cursor";
import { LiquidGlassFilter } from "@/components/landing/LiquidGlassFilter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SmoothScroll } from "@/components/landing/SmoothScroll";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-site grain min-h-screen">
      <LiquidGlassFilter />
      <SmoothScroll>
        <SiteHeader />
        {children}
      </SmoothScroll>
      <Cursor />
    </div>
  );
}
