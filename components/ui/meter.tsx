import { cn } from "@/lib/utils";

export function Meter({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-moss/10 dark:bg-sage/10",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-moss transition-all dark:bg-sage"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
