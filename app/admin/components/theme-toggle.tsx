"use client";

import { MoonIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      className="gap-2 bg-card"
      aria-label="Toggle dark mode"
      title="Theme switching is temporarily disabled"
    >
      <MoonIcon className="size-4" />
      Dark
    </Button>
  );
}
