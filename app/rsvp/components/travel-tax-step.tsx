"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

import {
  FormQuestion,
  YesAcknowledgement,
} from "@/components/forms/form-question";
import { FormSectionCard } from "@/components/forms/form-section-card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVENT } from "@/lib/config/event";
import { formatCents } from "@/lib/currency";
import { TRAVEL_GUIDE_URL } from "@/lib/rsvp/travel-guide";
import type { RsvpFormData } from "@/lib/types/rsvps";
import { TRAVEL_OPTIONS } from "../form-options";
import { ReceiptUpload } from "./receipt-upload";

export function TravelTaxStep({
  canRequestReimbursement,
  reimbursementCents,
  receiptMutationInProgress,
  beforeReceiptMutation,
  onReceiptMutationChange,
  commitTravelPlanChange,
}: {
  canRequestReimbursement: boolean;
  reimbursementCents: number | null;
  receiptMutationInProgress: boolean;
  beforeReceiptMutation: () => Promise<void>;
  onReceiptMutationChange: (inProgress: boolean) => void;
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
  const travelGuideAcknowledged = useWatch({
    control,
    name: "travelGuideAcknowledged",
  });
  const [branchError, setBranchError] = useState<string | null>(null);
  const [travelGuideOpened, setTravelGuideOpened] = useState(false);
  const travelGuideUnlocked =
    travelGuideOpened || travelGuideAcknowledged === true;
  const handleOpenTravelGuide = () => setTravelGuideOpened(true);
  const travelOptions = TRAVEL_OPTIONS.filter((option) =>
    canRequestReimbursement ? true : option.value !== "reimbursement",
  );
  const reimbursementLabel =
    reimbursementCents != null
      ? `I will apply for a travel reimbursement (${formatCents(reimbursementCents)}).`
      : TRAVEL_OPTIONS.find((option) => option.value === "reimbursement")!
          .label;

  useEffect(() => {
    if (
      canRequestReimbursement ||
      (travelPlan && travelPlan !== "reimbursement")
    ) {
      return;
    }
    setValue("travelPlan", "self-funded", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("travelGuideAcknowledged", undefined, { shouldDirty: true });
    setValue("flightBooked", undefined, { shouldDirty: true });
    setValue("receiptBindingAcknowledged", undefined, { shouldDirty: true });
    setValue("receipt", undefined, { shouldDirty: true });
    clearErrors([
      "travelPlan",
      "travelGuideAcknowledged",
      "flightBooked",
      "receiptBindingAcknowledged",
      "receipt",
    ]);
  }, [canRequestReimbursement, clearErrors, setValue, travelPlan]);

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
      <FormSectionCard>
        <FormQuestion
          label={`How do you plan to travel to ${EVENT.fullName}?`}
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
                    if (next === "reimbursement") {
                      void beforeReceiptMutation();
                    }
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
                {travelOptions.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="h-auto min-h-10 justify-start whitespace-normal py-2 text-left font-red-hat"
                  >
                    {option.value === "reimbursement"
                      ? reimbursementLabel
                      : option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </FormQuestion>

        {branchError && (
          <p className="font-red-hat text-xs text-destructive" role="alert">
            {branchError}
          </p>
        )}

        <p className="font-red-hat text-xs leading-5 text-moss/55">
          Only hackers with an approved travel reimbursement award can apply for
          reimbursement.
        </p>

        {travelPlan === "self-funded" && (
          <p className="font-red-hat text-sm leading-6 text-moss">
            Please read the{" "}
            <a
              href={TRAVEL_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-moss underline underline-offset-4"
            >
              MHacks 2026 Travel Guide
            </a>{" "}
            before you travel to Ann Arbor.
          </p>
        )}

        {canRequestReimbursement && travelPlan === "reimbursement" && (
          <div className="flex flex-col gap-5 rounded-2xl border border-moss/10 bg-white/70 p-4 shadow-[0_1px_0_rgba(58,74,38,0.08)] sm:p-5">
            {reimbursementCents != null && (
              <p className="font-red-hat text-sm leading-6 text-moss">
                Your approved travel reimbursement is{" "}
                <span className="font-semibold">
                  {formatCents(reimbursementCents)}
                </span>
                .
              </p>
            )}
            <Controller
              name="travelGuideAcknowledged"
              control={control}
              render={({ field }) => (
                <YesAcknowledgement
                  id="travelGuideAcknowledged"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  error={errors.travelGuideAcknowledged}
                  disabled={!travelGuideUnlocked}
                  disabledMessage={
                    travelGuideUnlocked
                      ? undefined
                      : `Open the ${EVENT.fullName} Travel Guide before acknowledging.`
                  }
                >
                  I have read the{" "}
                  <a
                    href={TRAVEL_GUIDE_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleOpenTravelGuide}
                    className="font-medium text-moss underline underline-offset-4"
                  >
                    {EVENT.fullName} Travel Guide
                  </a>{" "}
                  and understand I will only be eligible for travel
                  reimbursement if all criteria are met. I understand that if
                  not all requirements are met, my reimbursement request may be
                  denied.
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
                  I have booked my flight to {EVENT.fullName}.
                </YesAcknowledgement>
              )}
            />

            <ReceiptUpload
              disabled={receiptMutationInProgress}
              beforeMutation={beforeReceiptMutation}
              onMutationChange={onReceiptMutationChange}
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
                  I understand this submission is binding and I will NOT be able
                  to submit a new receipt if the information is incorrect.
                </YesAcknowledgement>
              )}
            />
          </div>
        )}
      </FormSectionCard>
    </div>
  );
}
