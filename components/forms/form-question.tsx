"use client";

import type { ReactNode } from "react";
import { CircleHelpIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type FormFieldError = { message?: string };

export function FormQuestion({
  label,
  htmlFor,
  required,
  description,
  error,
  className,
  helpText,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  description?: string;
  error?: FormFieldError;
  className?: string;
  helpText?: string;
  children: ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div
      className={`flex flex-col gap-2${className ? ` ${className}` : ""}`}
      data-invalid={error ? true : undefined}
    >
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor} className="font-red-hat">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </Label>
        {helpText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full text-moss/45 transition-colors hover:text-moss focus-visible:ring-2 focus-visible:ring-moss/30 focus-visible:outline-none"
                aria-label={`${label} help`}
              >
                <CircleHelpIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="leading-5">
              <span className="font-red-hat text-xs leading-5">{helpText}</span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {description && (
        <p className="font-red-hat text-xs leading-5 text-moss/55">
          {description}
        </p>
      )}
      {children}
      {error?.message && (
        <p
          id={errorId}
          className="font-red-hat text-xs text-destructive"
          role="alert"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}

export function YesAcknowledgement({
  id,
  checked,
  onCheckedChange,
  children,
  error,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  error?: FormFieldError;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <Label
          htmlFor={id}
          className="block min-w-0 flex-1 font-red-hat text-sm leading-6 text-foreground"
        >
          {children}
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        </Label>
      </div>
      {error?.message && (
        <p
          id={`${id}-error`}
          className="font-red-hat text-xs text-destructive"
          role="alert"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}

export function BooleanChoice({
  id,
  value,
  onChange,
  error,
  disabled = false,
  disabledMessage,
}: {
  id: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  error?: FormFieldError;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const helperId = disabledMessage ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        type="single"
        value={value === undefined ? "" : String(value)}
        onValueChange={(next) => {
          if (next) onChange(next === "true");
        }}
        variant="outline"
        spacing={2}
        aria-label={id}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [helperId, errorId].filter(Boolean).join(" ") || undefined
        }
        disabled={disabled}
      >
        <ToggleGroupItem value="true" className="font-red-hat">
          Yes
        </ToggleGroupItem>
        <ToggleGroupItem value="false" className="font-red-hat">
          No
        </ToggleGroupItem>
      </ToggleGroup>
      {disabledMessage && (
        <p id={helperId} className="font-red-hat text-xs text-moss/55">
          {disabledMessage}
        </p>
      )}
      {error?.message && (
        <p
          id={errorId}
          className="font-red-hat text-xs text-destructive"
          role="alert"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
