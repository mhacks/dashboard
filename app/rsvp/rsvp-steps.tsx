"use client";

import { useRef, useState, type ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  CircleHelpIcon,
  FileCheckIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import {
  confirmRsvpReceiptUpload,
  removeRsvpReceipt,
  requestRsvpReceiptUpload,
} from "@/lib/actions/rsvp-receipt.server.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MAX_RSVP_RECEIPT_SIZE_BYTES,
  isRsvpReceiptContentType,
} from "@/lib/rsvp/receipt";
import {
  CANADA_PROVINCE_OPTIONS,
  COUNTRY_OPTIONS,
  US_STATE_OPTIONS,
} from "@/lib/geo/address";
import type { RsvpFormData } from "@/lib/types/rsvps";
import {
  DIETARY_OPTIONS,
  TRAVEL_OPTIONS,
  TSHIRT_OPTIONS,
} from "./form-options";

const SECTION_CARD_CLASS = "shadow-none";
const SECTION_CARD_STYLE = { borderColor: "rgba(58,74,38,0.15)" };
const SECTION_CONTENT_CLASS = "space-y-4 font-red-hat";

function formatPostalCodeInput(country: string | undefined, value: string) {
  if (country === "United States") {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    return digits.length > 5
      ? `${digits.slice(0, 5)}-${digits.slice(5)}`
      : digits;
  }

  if (country === "Canada") {
    const characters = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    return characters.length > 3
      ? `${characters.slice(0, 3)} ${characters.slice(3)}`
      : characters;
  }

  return value.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 32);
}

function Question({
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
  error?: { message?: string };
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

function YesAcknowledgement({
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
  error?: { message?: string };
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
          className="font-red-hat text-sm leading-6 text-foreground"
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

function BooleanChoice({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  error?: { message?: string };
}) {
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
      >
        <ToggleGroupItem value="true" className="font-red-hat">
          Yes
        </ToggleGroupItem>
        <ToggleGroupItem value="false" className="font-red-hat">
          No
        </ToggleGroupItem>
      </ToggleGroup>
      {error?.message && (
        <p className="font-red-hat text-xs text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

export function PersonalStep() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<RsvpFormData>();
  const country = useWatch({ control, name: "country" });
  const stateOptions =
    country === "United States"
      ? US_STATE_OPTIONS
      : country === "Canada"
        ? CANADA_PROVINCE_OPTIONS
        : null;

  return (
    <Card className={SECTION_CARD_CLASS} style={SECTION_CARD_STYLE}>
      <CardContent className={SECTION_CONTENT_CLASS}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Question
            label="Full legal name"
            htmlFor="legalName"
            required
            helpText="We'll verify your identity at check-in. Bring a student ID, driver's license/state ID, passport, or another photo ID that matches this name."
            error={errors.legalName}
          >
            <Input
              id="legalName"
              autoComplete="name"
              aria-invalid={Boolean(errors.legalName)}
              {...register("legalName")}
            />
          </Question>

          <Question
            label="Preferred name"
            htmlFor="preferredName"
            required
            error={errors.preferredName}
          >
            <Input
              id="preferredName"
              autoComplete="nickname"
              aria-invalid={Boolean(errors.preferredName)}
              {...register("preferredName")}
            />
          </Question>

          <Question
            label="Email address"
            htmlFor="email"
            required
            error={errors.email}
            className="md:col-span-2"
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </Question>

          <div className="md:col-span-2">
            <Controller
              name="emailMatchesApplication"
              control={control}
              render={({ field }) => (
                <YesAcknowledgement
                  id="emailMatchesApplication"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  error={errors.emailMatchesApplication}
                >
                  This is the same email address I used to apply to MHacks 2026.
                </YesAcknowledgement>
              )}
            />
          </div>

          <div className="md:col-span-2">
            <Controller
              name="incorrectEmailRiskAcknowledged"
              control={control}
              render={({ field }) => (
                <YesAcknowledgement
                  id="incorrectEmailRiskAcknowledged"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  error={errors.incorrectEmailRiskAcknowledged}
                >
                  I understand that if I have entered the wrong email, I may
                  lose my spot at MHacks 2026.
                </YesAcknowledgement>
              )}
            />
          </div>

          <div className="pt-3 md:col-span-2">
            <p className="font-red-hat text-sm leading-none font-medium text-moss">
              Address
            </p>
          </div>

          <Question
            label="Street Address"
            htmlFor="streetAddress"
            required
            error={errors.streetAddress}
            className="md:col-span-2"
          >
            <Input
              id="streetAddress"
              autoComplete="street-address"
              aria-invalid={Boolean(errors.streetAddress)}
              {...register("streetAddress")}
            />
          </Question>

          <Question
            label="Country"
            htmlFor="country"
            required
            error={errors.country}
          >
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(next) => {
                    field.onChange(next);
                    setValue("stateOrProvince", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("postalCode", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                >
                  <SelectTrigger
                    id="country"
                    aria-invalid={Boolean(errors.country)}
                  >
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {COUNTRY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </Question>

          <Question label="City" htmlFor="city" required error={errors.city}>
            <Input
              id="city"
              autoComplete="address-level2"
              aria-invalid={Boolean(errors.city)}
              {...register("city")}
            />
          </Question>

          {stateOptions && (
            <Question
              label={country === "United States" ? "State" : "Province"}
              htmlFor="stateOrProvince"
              required
              error={errors.stateOrProvince}
            >
              <Controller
                name="stateOrProvince"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="stateOrProvince"
                      aria-invalid={Boolean(errors.stateOrProvince)}
                    >
                      <SelectValue
                        placeholder={
                          country === "United States"
                            ? "Select state"
                            : "Select province"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {stateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </Question>
          )}

          {stateOptions && (
            <Question
              label={country === "United States" ? "ZIP Code" : "Postal Code"}
              htmlFor="postalCode"
              required
              error={errors.postalCode}
            >
              <Controller
                name="postalCode"
                control={control}
                render={({ field }) => (
                  <Input
                    id="postalCode"
                    autoComplete="postal-code"
                    inputMode={country === "United States" ? "numeric" : "text"}
                    aria-invalid={Boolean(errors.postalCode)}
                    value={field.value ?? ""}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(
                        formatPostalCodeInput(country, event.target.value),
                      )
                    }
                  />
                )}
              />
            </Question>
          )}

          <div className="pt-3 md:col-span-2">
            <p className="font-red-hat text-sm leading-none font-medium text-moss">
              Preferences
            </p>
          </div>

          <Question
            label="Dietary Restrictions"
            required
            error={errors.dietaryRestrictions}
            className="md:col-span-2"
          >
            <Controller
              name="dietaryRestrictions"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  type="multiple"
                  value={field.value ?? []}
                  onValueChange={(next) => {
                    const current = field.value ?? [];
                    let normalized = next;
                    if (next.includes("none") && !current.includes("none")) {
                      normalized = ["none"];
                    } else if (next.some((value) => value !== "none")) {
                      normalized = next.filter((value) => value !== "none");
                    }
                    if (!normalized.includes("other")) {
                      setValue("otherDietaryRestriction", undefined, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                    field.onChange(normalized);
                  }}
                  variant="outline"
                  spacing={2}
                  className="w-full flex-wrap justify-start"
                  aria-label="Dietary restrictions"
                  aria-invalid={Boolean(errors.dietaryRestrictions)}
                >
                  {DIETARY_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      className="font-red-hat"
                    >
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          </Question>

          <Controller
            name="dietaryRestrictions"
            control={control}
            render={({ field }) =>
              field.value?.includes("other") ? (
                <Question
                  label="Other dietary restriction"
                  htmlFor="otherDietaryRestriction"
                  required
                  error={errors.otherDietaryRestriction}
                  className="md:col-span-2"
                >
                  <Input
                    id="otherDietaryRestriction"
                    aria-invalid={Boolean(errors.otherDietaryRestriction)}
                    {...register("otherDietaryRestriction")}
                  />
                </Question>
              ) : (
                <></>
              )
            }
          />

          <Question
            label="T-shirt size"
            required
            error={errors.tshirtSize}
            className="md:col-span-2"
          >
            <Controller
              name="tshirtSize"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={Boolean(errors.tshirtSize)}>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {TSHIRT_OPTIONS.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </Question>
        </div>
      </CardContent>
    </Card>
  );
}

type UploadState = "idle" | "uploading" | "removing" | "error";
type ReceiptMutationVersion = {
  receiptVersion: number;
};

function ReceiptUpload({
  disabled,
  receiptVersion,
  beforeMutation,
  onMutationChange,
  onVersionChange,
}: {
  disabled: boolean;
  receiptVersion: number;
  beforeMutation: () => Promise<void>;
  onMutationChange: (inProgress: boolean) => void;
  onVersionChange: (version: ReceiptMutationVersion) => void;
}) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<RsvpFormData>();
  const receipt = useWatch({ control, name: "receipt" });
  const inputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(0);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (disabled) return;
    if (!isRsvpReceiptContentType(file.type)) {
      setState("error");
      setMessage("Choose a PDF, PNG, or JPEG file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_RSVP_RECEIPT_SIZE_BYTES) {
      setState("error");
      setMessage("Choose a non-empty file no larger than 10 MB.");
      return;
    }

    const operation = ++operationRef.current;
    onMutationChange(true);
    setState("uploading");
    setMessage("Uploading and verifying receipt…");
    try {
      await beforeMutation();
      const { uploadUrl, uploadId, expectedReceiptVersion } =
        await requestRsvpReceiptUpload({
          originalName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          expectedReceiptVersion: receiptVersion,
        });
      onVersionChange({ receiptVersion: expectedReceiptVersion });
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!upload.ok) throw new Error("Storage rejected the upload");

      const confirmed = await confirmRsvpReceiptUpload({
        uploadId,
        originalName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        expectedReceiptVersion,
      });
      if (
        operation !== operationRef.current ||
        getValues("travelPlan") !== "reimbursement"
      ) {
        const removed = await removeRsvpReceipt({
          expectedReceiptVersion: confirmed.receiptVersion,
        });
        onVersionChange(removed);
        return;
      }
      setValue("receipt", confirmed.receipt, {
        shouldDirty: true,
        shouldValidate: true,
      });
      onVersionChange(confirmed);
      setState("idle");
      setMessage("Receipt uploaded and verified.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      if (operation === operationRef.current) onMutationChange(false);
    }
  };

  const handleRemove = async () => {
    if (disabled) return;
    operationRef.current += 1;
    onMutationChange(true);
    setState("removing");
    setMessage("Removing receipt…");
    try {
      await beforeMutation();
      const removed = await removeRsvpReceipt({
        expectedReceiptVersion: receiptVersion,
      });
      setValue("receipt", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
      onVersionChange(removed);
      setState("idle");
      setMessage("Receipt removed.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove the receipt.",
      );
    } finally {
      onMutationChange(false);
    }
  };

  return (
    <Question
      label="Travel reimbursement receipt"
      htmlFor="receipt"
      required
      description="Upload 1 supported file. Max 10 MB. PDF, PNG, or JPEG."
      error={errors.receipt}
    >
      {receipt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-moss/10 bg-moss/5 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileCheckIcon className="size-4 shrink-0 text-moss" />
            <span className="truncate font-red-hat text-sm text-moss">
              {receipt.originalName}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || state === "uploading" || state === "removing"}
            onClick={handleRemove}
            className="rounded-full border-moss/20 bg-transparent px-3 font-red-hat text-moss hover:bg-black/5"
          >
            <Trash2Icon data-icon="inline-start" />
            Remove
          </Button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Input
          ref={inputRef}
          id="receipt"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          disabled={disabled || state === "uploading" || state === "removing"}
          aria-invalid={Boolean(errors.receipt)}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void handleFile(file);
          }}
          className="min-w-0"
        />
        <UploadIcon
          className="size-4 shrink-0 text-moss/50"
          aria-hidden="true"
        />
      </div>
      {message && (
        <p
          className={
            state === "error"
              ? "font-red-hat text-xs text-destructive"
              : "font-red-hat text-xs text-moss/55"
          }
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </Question>
  );
}

export function TravelTaxStep({
  receiptMutationInProgress,
  receiptVersion,
  beforeReceiptMutation,
  onReceiptMutationChange,
  onReceiptVersionChange,
  commitTravelPlanChange,
}: {
  receiptMutationInProgress: boolean;
  receiptVersion: number;
  beforeReceiptMutation: () => Promise<void>;
  onReceiptMutationChange: (inProgress: boolean) => void;
  onReceiptVersionChange: (version: ReceiptMutationVersion) => void;
  commitTravelPlanChange: (data: RsvpFormData) => Promise<void>;
}) {
  const {
    control,
    getValues,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<RsvpFormData>();
  const travelPlan = useWatch({ control, name: "travelPlan" });
  const [branchError, setBranchError] = useState<string | null>(null);

  const leaveReimbursement = async (
    nextTravelPlan: Exclude<RsvpFormData["travelPlan"], "reimbursement">,
    onChange: (value: RsvpFormData["travelPlan"]) => void,
  ) => {
    const previous = {
      travelGuideAcknowledged: getValues("travelGuideAcknowledged"),
      flightBooked: getValues("flightBooked"),
      receiptBindingAcknowledged: getValues("receiptBindingAcknowledged"),
      receipt: getValues("receipt"),
    };
    onReceiptMutationChange(true);
    try {
      await beforeReceiptMutation();
      onChange(nextTravelPlan);
      setValue("travelGuideAcknowledged", undefined, { shouldDirty: true });
      setValue("flightBooked", undefined, { shouldDirty: true });
      setValue("receiptBindingAcknowledged", undefined, {
        shouldDirty: true,
      });
      setValue("receipt", undefined, { shouldDirty: true });
      await commitTravelPlanChange(getValues());
      clearErrors([
        "travelGuideAcknowledged",
        "flightBooked",
        "receiptBindingAcknowledged",
        "receipt",
      ]);
      setBranchError(null);
    } catch (error) {
      onChange("reimbursement");
      setValue("travelGuideAcknowledged", previous.travelGuideAcknowledged, {
        shouldDirty: true,
      });
      setValue("flightBooked", previous.flightBooked, { shouldDirty: true });
      setValue(
        "receiptBindingAcknowledged",
        previous.receiptBindingAcknowledged,
        { shouldDirty: true },
      );
      setValue("receipt", previous.receipt, { shouldDirty: true });
      setBranchError(
        error instanceof Error
          ? error.message
          : "The travel plan could not be changed. Please try again.",
      );
    } finally {
      onReceiptMutationChange(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className={SECTION_CARD_CLASS} style={SECTION_CARD_STYLE}>
        <CardContent className={SECTION_CONTENT_CLASS}>
          <Question
            label="How do you plan to travel to MHacks 2026?"
            required
            error={errors.travelPlan}
          >
            <Controller
              name="travelPlan"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  value={field.value ?? ""}
                  onValueChange={(next) => {
                    if (!next) return;
                    const wasReimbursement = field.value === "reimbursement";
                    if (wasReimbursement && next !== "reimbursement") {
                      void leaveReimbursement(
                        next as Exclude<
                          RsvpFormData["travelPlan"],
                          "reimbursement"
                        >,
                        field.onChange,
                      );
                    } else {
                      field.onChange(next);
                    }
                  }}
                  variant="outline"
                  orientation="vertical"
                  spacing={2}
                  disabled={receiptMutationInProgress}
                  className="w-full items-stretch"
                  aria-label="Travel plan"
                  aria-invalid={Boolean(errors.travelPlan)}
                >
                  {TRAVEL_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      className="h-auto min-h-10 justify-start whitespace-normal py-2 text-left font-red-hat"
                    >
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          </Question>

          {branchError && (
            <p className="font-red-hat text-xs text-destructive" role="alert">
              {branchError}
            </p>
          )}

          {travelPlan === "reimbursement" && (
            <div className="flex flex-col gap-5 rounded-2xl border border-moss/10 bg-moss/5 p-4 sm:p-5">
              <Controller
                name="travelGuideAcknowledged"
                control={control}
                render={({ field }) => (
                  <YesAcknowledgement
                    id="travelGuideAcknowledged"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    error={errors.travelGuideAcknowledged}
                  >
                    I have read the MHacks 2026 Travel Guide and understand I
                    will only be eligible for travel reimbursement if all
                    criteria are met. I understand that if not all requirements
                    are met, my reimbursement request may be denied.
                  </YesAcknowledgement>
                )}
              />

              <Controller
                name="flightBooked"
                control={control}
                render={({ field }) => (
                  <YesAcknowledgement
                    id="flightBooked"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    error={errors.flightBooked}
                  >
                    I have booked my flight to MHacks 2026.
                  </YesAcknowledgement>
                )}
              />

              <ReceiptUpload
                disabled={receiptMutationInProgress}
                receiptVersion={receiptVersion}
                beforeMutation={beforeReceiptMutation}
                onMutationChange={onReceiptMutationChange}
                onVersionChange={onReceiptVersionChange}
              />

              <Controller
                name="receiptBindingAcknowledged"
                control={control}
                render={({ field }) => (
                  <YesAcknowledgement
                    id="receiptBindingAcknowledged"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    error={errors.receiptBindingAcknowledged}
                  >
                    I understand this submission is binding and I will NOT be
                    able to submit a new receipt if the information is
                    incorrect.
                  </YesAcknowledgement>
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function WaiversStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<RsvpFormData>();

  return (
    <div className="flex flex-col gap-5">
      <Card className={SECTION_CARD_CLASS} style={SECTION_CARD_STYLE}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-red-hat text-sm leading-6 text-foreground">
              I confirm that I have read and understood the Activities Waiver
              document. The above agreements are binding upon me, my estate,
              heirs, representatives, and assigns. I understand that selecting
              &quot;No&quot; will not allow me to participate a select few
              activites at MHacks 2026.
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </p>
            <Controller
              name="activitiesWaiverResponse"
              control={control}
              render={({ field }) => (
                <BooleanChoice
                  id="activities-waiver"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.activitiesWaiverResponse}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={SECTION_CARD_CLASS} style={SECTION_CARD_STYLE}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 font-red-hat text-sm leading-6 text-foreground">
            <p>
              I hereby grant the MHacks permission to use my likeness in a
              photograph, video, or other digital media (&quot;photo&quot;) in
              any and all of its publications, including web-based publications,
              without payment or other consideration.
            </p>
            <p>
              I understand and agree that all photos will become the property of
              the MHacks and will not be returned.
            </p>
            <p>
              I hereby irrevocably authorize the MHacks to edit, alter, copy,
              exhibit, publish, or distribute these photos for any lawful
              purpose. In addition, I waive any right to inspect or approve the
              finished product wherein my likeness appears. Additionally, I
              waive any right to royalties or other compensation arising or
              related to the use of the photo.
            </p>
            <p>
              I hereby hold harmless, release, and forever discharge the MHacks
              from all claims, demands, and causes of action which I, my heirs,
              representatives, executors, administrators, or any other persons
              acting on my behalf or on behalf of my estate have or may have by
              reason of this authorization.
            </p>
            <p className="font-semibold">
              I HAVE READ AND UNDERSTAND THE ABOVE PHOTO RELEASE.
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </p>
          </div>
          <Controller
            name="photoReleaseResponse"
            control={control}
            render={({ field }) => (
              <BooleanChoice
                id="photo-release"
                value={field.value}
                onChange={field.onChange}
                error={errors.photoReleaseResponse}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card className={SECTION_CARD_CLASS} style={SECTION_CARD_STYLE}>
        <CardContent className="flex flex-col gap-3">
          <p className="font-red-hat text-[10px] font-semibold uppercase tracking-[0.3em] text-moss/45">
            LAST ONE!
          </p>
          <Question
            label="Anything else you'd like the MHacks Team to know?"
            htmlFor="additionalNotes"
            error={errors.additionalNotes}
          >
            <Textarea
              id="additionalNotes"
              rows={5}
              aria-invalid={Boolean(errors.additionalNotes)}
              {...register("additionalNotes")}
            />
          </Question>
        </CardContent>
      </Card>
    </div>
  );
}
