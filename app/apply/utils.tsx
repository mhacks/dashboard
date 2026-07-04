import { Label } from "@/components/ui/label";

// Normalizes input to E.164 as the user types: +12345678901.
// Non-digits are stripped, a leading "+" is kept, and the result is capped at
// 15 digits (the E.164 maximum).
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (digits.length === 0) return "";
  return `+${digits}`;
}

export function FormField({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2${className ? ` ${className}` : ""}`}>
      <Label className="font-red-hat">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {/* font-red-hat so all fill-in fields render in Red Hat Display while
          the label above keeps its own font. */}
      <div className="space-y-2 font-red-hat">{children}</div>
    </div>
  );
}
