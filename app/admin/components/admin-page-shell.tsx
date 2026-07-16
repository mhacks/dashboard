import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPageShell({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: "wide" | "narrow";
  className?: string;
}) {
  return (
    <main
      className={cn(
        "min-h-screen bg-background px-4 py-5 text-foreground md:px-6",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-col gap-6",
          width === "narrow" ? "max-w-3xl" : "max-w-7xl",
        )}
      >
        {children}
      </div>
    </main>
  );
}
