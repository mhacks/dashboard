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
  // "Other" mode is on when the user chose it, or when an external form update
  // sets a value that doesn't match a known option.
  const [isOtherSelected, setIsOtherSelected] = useState(
    () => !!value && !options.some((o) => o.value === value),
  );

  const valueMatchesOption = options.some((o) => o.value === value);
  const isOther = isOtherSelected || (!!value && !valueMatchesOption);
  const selectValue = isOther ? otherValue : (value ?? "");

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === otherValue) {
            setIsOtherSelected(true);
            onChange(""); // clear so the user types their own value
          } else {
            setIsOtherSelected(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger className="font-red-hat">
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
          className="font-red-hat placeholder:font-red-hat"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          autoFocus
        />
      )}
    </div>
  );
}
