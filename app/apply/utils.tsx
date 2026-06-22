import { Label } from "@/components/ui/label";

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
