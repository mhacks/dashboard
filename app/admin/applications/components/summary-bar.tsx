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
    // Wraps rather than dividing a single row N ways: at six or more tiles a
    // flex-1 row squeezes every hint into a column of one-word lines. The
    // basis floor lets tiles reflow onto a second row instead. Separators are
    // per-tile borders pulled a pixel past the clipped edge, so the trailing
    // row and column don't double up with the section border.
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="-mb-px -mr-px flex flex-wrap">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 flex-1 basis-[15rem] gap-3 border-b border-r border-border/60 px-4 py-4"
          >
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
      </div>
    </section>
  );
}
