import { Loader2, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function RecipientSearchField({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  onBlur,
  onFocus,
  "aria-label": ariaLabel,
  isLoading = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
  onBlur?: () => void;
  onFocus?: () => void;
  "aria-label"?: string;
  isLoading?: boolean;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-busy={isLoading}
        className={cn("h-8 pl-8 text-xs", isLoading && "pr-9", inputClassName)}
      />
      {isLoading ? (
        <Loader2
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      ) : null}
    </div>
  );
}
