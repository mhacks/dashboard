"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Option = { value: string; label: string };

/**
 * A dropdown whose selected value is stored directly as text. When the user
 * picks the "other" option, a free-text input is revealed and its text becomes
 * the stored value — so there is no separate `*_other` field/column.
 */
export function SelectWithOther({
  value,
  onChange,
  options,
  otherValue = "other",
  placeholder,
  otherPlaceholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  /** The option value that means "let me type my own". */
  otherValue?: string;
  placeholder?: string;
  otherPlaceholder?: string;
}) {
  // "Other" mode is on when there's a value that doesn't match a known option
  // (e.g. a previously typed custom value when editing).
  const [isOther, setIsOther] = useState(
    () => !!value && !options.some((o) => o.value === value),
  );

  const selectValue = isOther ? otherValue : (value ?? "");

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === otherValue) {
            setIsOther(true);
            onChange(""); // clear so the user types their own value
          } else {
            setIsOther(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOther && (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          autoFocus
        />
      )}
    </div>
  );
}
