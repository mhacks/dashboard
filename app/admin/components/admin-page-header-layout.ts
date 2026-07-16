import { cn } from "@/lib/utils";

export type AdminPageHeaderVariant = "page" | "workspace";

export function adminPageHeaderClasses(variant: AdminPageHeaderVariant) {
  const isWorkspace = variant === "workspace";

  return {
    header: cn(
      isWorkspace
        ? "shrink-0 border-b bg-card/80 px-4 py-3 backdrop-blur md:px-6"
        : "border-b pb-5",
    ),
    row: cn(
      "flex gap-3",
      isWorkspace
        ? "items-start justify-between"
        : "flex-col lg:flex-row lg:items-end lg:justify-between",
    ),
    title: cn(
      "font-heading italic tracking-tight text-moss dark:text-sage",
      isWorkspace ? "text-2xl sm:text-3xl" : "text-4xl",
    ),
  };
}
