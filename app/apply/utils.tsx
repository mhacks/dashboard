import { Label } from "@/components/ui/label";

// Formats a US phone number as the user types: (123) 456-7890.
// Non-digits are stripped and the input is capped at 10 digits.
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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
