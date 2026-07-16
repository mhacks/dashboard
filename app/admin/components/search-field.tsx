import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  iconClassName,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <SearchIcon
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground",
          iconClassName,
        )}
      />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={cn("pl-9", inputClassName)}
        aria-label={ariaLabel}
      />
    </div>
  );
}
