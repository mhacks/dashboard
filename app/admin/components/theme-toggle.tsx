"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";

export default function ThemeToggle() {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="gap-2 bg-card"
      aria-label="Toggle dark mode"
      title="Theme switching is temporarily disabled"
    >
      {isDark ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
      {isDark ? "Light" : "Dark"}
    </Button>
  );
}
