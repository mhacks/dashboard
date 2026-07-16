import type { ReactNode } from "react";

export function SummaryBar({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    hint: string;
    icon: ReactNode;
  }>;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card md:flex md:divide-x md:divide-border/60">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 gap-3 px-4 py-4">
          <div className="shrink-0 text-moss dark:text-sage">{item.icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="font-heading text-2xl italic text-moss dark:text-sage">
              {item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {item.hint}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
