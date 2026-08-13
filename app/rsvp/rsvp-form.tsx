"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FormProvider,
  useForm,
  useWatch,
  type DefaultValues,
} from "react-hook-form";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";

import {
  saveRsvpDraftWithoutReceipt,
  submitRsvp,
} from "@/lib/actions/rsvp.server.actions";
import { FormStepProgress } from "@/components/forms/form-step-progress";
import {
  rsvpFormSchema,
  type RsvpDraftData,
  type RsvpFormData,
} from "@/lib/types/rsvps";
import {
  applyTravelEligibilityDefaults,
  hasRsvpAddressTravelSignal,
  isAnnArborRegionAddress,
  type RsvpTravelEligibility,
} from "@/lib/rsvp/travel-eligibility";
import { getRsvpSteps } from "./form-options";
import { RsvpPageShell } from "./rsvp-page-shell";
import { RsvpSummary } from "./rsvp-summary";
import { PersonalStep, TravelTaxStep, WaiversStep } from "./components";
import {
  consumeRestorablePendingRsvp,
  useRsvpAutosave,
} from "./use-rsvp-autosave";

const EASE = [0.25, 0.1, 0.25, 1] as const;

function defaultValues(
  draft: RsvpDraftData,
  accountEmail: string,
  travelEligibility: RsvpTravelEligibility,
): DefaultValues<RsvpFormData> {
  const travelDefaults = applyTravelEligibilityDefaults(
    draft,
    travelEligibility,
  );
  const isReimbursement = travelDefaults.travelPlan === "reimbursement";

  return {
    legalName: draft.legalName ?? "",
    preferredName: draft.preferredName ?? "",
    email: accountEmail,
    emailMatchesApplication: true,
    incorrectEmailRiskAcknowledged: true,
    dietaryRestrictions: draft.dietaryRestrictions ?? [],
    otherDietaryRestriction: draft.otherDietaryRestriction,
    tshirtSize: draft.tshirtSize,
    travelPlan: travelDefaults.travelPlan,
    travelGuideAcknowledged: isReimbursement
      ? draft.travelGuideAcknowledged
      : undefined,
    flightBooked: isReimbursement ? draft.flightBooked : undefined,
    receipt: isReimbursement ? draft.receipt : undefined,
    receiptBindingAcknowledged: isReimbursement
      ? draft.receiptBindingAcknowledged
      : undefined,
    streetAddress: draft.streetAddress ?? "",
    city: draft.city ?? "",
    stateOrProvince: draft.stateOrProvince ?? "",
    postalCode: draft.postalCode ?? "",
    country: draft.country ?? "",
    activitiesWaiverResponse: draft.activitiesWaiverResponse,
    photoReleaseResponse: draft.photoReleaseResponse,
    additionalNotes: draft.additionalNotes ?? "",
  };
}

function SaveIndicator({
  status,
  onRetry,
}: {
  status: ReturnType<typeof useRsvpAutosave>["status"];
  onRetry: () => void;
}) {
  if (status === "idle") return null;
  return (
    <span
      className={
        status === "error"
          ? "font-red-hat text-[11px] text-red-200"
          : "font-red-hat text-[11px] text-white/45"
      }
      aria-live="polite"
    >
      {status === "saving"
        ? "Saving…"
        : status === "saved"
          ? "Saved"
          : "Failed to save"}
      {status === "error" && (
        <>
          {" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold text-white underline underline-offset-2"
          >
            Retry
          </button>
        </>
      )}
    </span>
  );
}

export default function RsvpForm({
  accountId,
  draft,
  accountEmail,
  travelEligibility,
  draftVersion,
  receiptVersion: initialReceiptVersion,
}: {
  accountId: string;
  draft: RsvpDraftData;
  accountEmail: string;
  travelEligibility: RsvpTravelEligibility;
  draftVersion: number;
  receiptVersion: number;
}) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receiptMutationInProgress, setReceiptMutationInProgress] =
    useState(false);
  const [receiptVersion, setReceiptVersion] = useState(initialReceiptVersion);
  const [submitted, setSubmitted] = useState<{
    values: RsvpFormData;
    submittedAt: string;
  } | null>(null);
  const {
    status: saveStatus,
    schedule: scheduleSave,
    flush: flushSave,
    retry: retrySave,
    stop: stopAutosave,
    getVersion: getDraftVersion,
    cancelPending: cancelPendingSave,
    completeExternalSave,
  } = useRsvpAutosave(accountId, draftVersion, draft);

  const methods = useForm<RsvpFormData>({
    resolver: zodResolver(rsvpFormSchema),
    mode: "onChange",
    defaultValues: defaultValues(draft, accountEmail, travelEligibility),
  });
  const {
    control,
    watch,
    trigger,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
  } = methods;
  const watchedValues = useWatch({ control }) as RsvpDraftData;
  const effectiveTravelEligibility = useMemo(() => {
    const address = {
      streetAddress: watchedValues.streetAddress,
      city: watchedValues.city,
      stateOrProvince: watchedValues.stateOrProvince,
      country: watchedValues.country,
    };

    if (hasRsvpAddressTravelSignal(address)) {
      const addressIsLocal = isAnnArborRegionAddress(address);
      return {
        showTravelStep: !addressIsLocal,
        canRequestReimbursement:
          !addressIsLocal && travelEligibility.nonLocalCanRequestReimbursement,
        nonLocalCanRequestReimbursement:
          travelEligibility.nonLocalCanRequestReimbursement,
        defaultTravelPlan: addressIsLocal
          ? "local"
          : travelEligibility.nonLocalCanRequestReimbursement
            ? "reimbursement"
            : "self-funded",
      } satisfies RsvpTravelEligibility;
    }
    return travelEligibility;
  }, [
    travelEligibility,
    watchedValues.city,
    watchedValues.country,
    watchedValues.stateOrProvince,
    watchedValues.streetAddress,
  ]);
  const steps = getRsvpSteps(effectiveTravelEligibility.showTravelStep);
  const currentStep = steps[Math.min(step, steps.length - 1)];
  const travelStepIndex = steps.findIndex((entry) => entry.id === "travel");
  const waiversStepIndex = steps.findIndex((entry) => entry.id === "waivers");
  const normalizedWatchedValues = applyTravelEligibilityDefaults(
    watchedValues,
    effectiveTravelEligibility,
  );
  const completeResult = rsvpFormSchema.safeParse(normalizedWatchedValues);
  const isComplete = completeResult.success;

  useEffect(() => {
    if (step < steps.length) return;
    setStep(steps.length - 1);
  }, [step, steps.length]);

  useEffect(() => {
    if (!effectiveTravelEligibility.showTravelStep) {
      if (watchedValues.travelPlan !== "local") {
        setValue("travelPlan", "local", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
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
      return;
    }

    if (
      !effectiveTravelEligibility.canRequestReimbursement &&
      (!watchedValues.travelPlan ||
        watchedValues.travelPlan === "reimbursement")
    ) {
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
      return;
    }

    if (
      effectiveTravelEligibility.canRequestReimbursement &&
      !watchedValues.travelPlan
    ) {
      setValue("travelPlan", effectiveTravelEligibility.defaultTravelPlan, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    clearErrors,
    effectiveTravelEligibility.canRequestReimbursement,
    effectiveTravelEligibility.defaultTravelPlan,
    effectiveTravelEligibility.showTravelStep,
    setValue,
    watchedValues.travelPlan,
  ]);

  useEffect(() => {
    // react-hook-form's subscription is intentionally used for debounced
    // persistence rather than rendering.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((values) => {
      scheduleSave(values as Partial<RsvpFormData>);
    });
    return () => subscription.unsubscribe();
  }, [watch, scheduleSave]);

  useEffect(() => {
    const pending = consumeRestorablePendingRsvp(accountId, draft);
    if (!pending) return;
    const restored = defaultValues(pending, accountEmail, travelEligibility);
    reset(restored);
    scheduleSave(restored as Partial<RsvpFormData>);
  }, [accountEmail, accountId, draft, reset, scheduleSave, travelEligibility]);

  const goNext = async () => {
    if (receiptMutationInProgress) return;
    const fields = currentStep.fields;
    if (fields.length > 0 && !(await trigger([...fields]))) return;
    setShowIncomplete(false);
    setDirection(1);
    setStep((current) => current + 1);
  };

  const goBack = () => {
    setShowIncomplete(false);
    setDirection(-1);
    setStep((current) => current - 1);
  };

  const onSubmit = async (values: RsvpFormData) => {
    if (step !== steps.length - 1 || receiptMutationInProgress) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const submissionValues = applyTravelEligibilityDefaults(
      values,
      effectiveTravelEligibility,
    ) as RsvpFormData;
    try {
      scheduleSave(submissionValues);
      await flushSave();
      const result = await submitRsvp({
        data: submissionValues,
        expectedReceiptVersion: receiptVersion,
      });
      stopAutosave();
      if (result.alreadySubmitted) {
        window.location.assign("/rsvp");
        return;
      }
      setSubmitted({
        values: submissionValues,
        submittedAt: result.submittedAt,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Your RSVP could not be submitted. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <RsvpPageShell accountId={accountId}>
        <main className="glass-card w-full max-w-2xl rounded-3xl px-5 py-8 sm:px-8 sm:py-10">
          <div className="mb-8 text-center">
            <CheckCircle2Icon className="mx-auto size-10 text-moss" />
            <h1 className="mt-4 font-heading text-4xl italic text-moss sm:text-5xl">
              RSVP Submitted!
            </h1>
            <p className="mt-3 font-red-hat text-sm leading-6 text-moss/65">
              Your spot is confirmed. Your response is now read-only.
            </p>
            <p className="mt-1 font-red-hat text-xs text-moss/45">
              Submitted{" "}
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(submitted.submittedAt))}
            </p>
          </div>
          <RsvpSummary
            values={submitted.values}
            receiptHref={
              submitted.values.travelPlan === "reimbursement"
                ? "/rsvp/receipt"
                : undefined
            }
            travelStepIndex={travelStepIndex >= 0 ? travelStepIndex : null}
            waiversStepIndex={waiversStepIndex}
          />
        </main>
      </RsvpPageShell>
    );
  }

  return (
    <RsvpPageShell
      accountId={accountId}
      onBeforeLogout={stopAutosave}
      status={<SaveIndicator status={saveStatus} onRetry={retrySave} />}
      stepCount={{ current: step + 1, total: steps.length }}
    >
      <motion.main
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: EASE, delay: 0.1 }}
        className="glass-card w-full max-w-2xl overflow-hidden rounded-3xl"
      >
        <div className="px-8 pt-8 pb-6">
          <div className="mb-6">
            <p className="mb-1 font-red-hat text-[10px] font-semibold tracking-[0.3em] text-moss/45 uppercase">
              RSVP
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <h1 className="font-heading text-4xl leading-tight tracking-tight text-moss italic sm:text-5xl">
                  {currentStep.label}
                </h1>
                <Image
                  src="/yellow_flower.png"
                  alt=""
                  width={68}
                  height={68}
                  className="pointer-events-none shrink-0 rotate-[-18deg] opacity-30 select-none"
                />
              </div>
            </div>
            <p className="mt-3 max-w-xl font-red-hat text-sm leading-6 text-moss/65">
              Please complete this form by{" "}
              <span className="mr-1 font-semibold text-moss">August 14th</span>
              to confirm your spot at MHacks 2026. We&apos;re so excited to have
              you here !!
            </p>
          </div>
          <FormStepProgress
            current={step}
            steps={steps}
            label="RSVP progress"
            itemClassName="w-16"
          />
        </div>

        <div className="mx-8 h-px bg-moss/8" />

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="px-8 py-7">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, x: 28 * direction }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, x: -28 * direction }
                }
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE }}
              >
                {currentStep.id === "personal" && <PersonalStep />}
                {currentStep.id === "travel" && (
                  <TravelTaxStep
                    canRequestReimbursement={
                      travelEligibility.canRequestReimbursement
                    }
                    receiptMutationInProgress={receiptMutationInProgress}
                    onReceiptMutationChange={setReceiptMutationInProgress}
                    receiptVersion={receiptVersion}
                    beforeReceiptMutation={flushSave}
                    onReceiptVersionChange={(next) => {
                      setReceiptVersion(next.receiptVersion);
                    }}
                    commitTravelPlanChange={async (data) => {
                      cancelPendingSave();
                      const saved = await saveRsvpDraftWithoutReceipt({
                        data,
                        expectedVersion: getDraftVersion(),
                        expectedReceiptVersion: receiptVersion,
                      });
                      completeExternalSave(data, saved.version);
                      setReceiptVersion(saved.receiptVersion);
                    }}
                  />
                )}
                {currentStep.id === "waivers" && <WaiversStep />}
                {currentStep.id === "review" && (
                  <RsvpSummary
                    values={normalizedWatchedValues}
                    travelStepIndex={
                      travelStepIndex >= 0 ? travelStepIndex : null
                    }
                    waiversStepIndex={waiversStepIndex}
                    onEdit={(target) => {
                      setDirection(target < step ? -1 : 1);
                      setStep(target);
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {submitError && (
              <div
                className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
                role="alert"
              >
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="font-red-hat text-xs leading-5 text-destructive">
                  {submitError}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-moss/8 pt-6 sm:flex-row sm:items-center">
              {step > 0 && (
                <button
                  type="button"
                  disabled={receiptMutationInProgress}
                  onClick={goBack}
                  className="rounded-full border border-moss/20 px-6 py-2.5 font-red-hat text-[13px] font-medium text-moss transition-colors hover:bg-black/5 disabled:pointer-events-none disabled:opacity-50"
                >
                  Back
                </button>
              )}
              <div className="flex-1" />
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  disabled={receiptMutationInProgress}
                  onClick={goNext}
                  className="rounded-full bg-moss px-7 py-2.5 font-red-hat text-[13px] font-medium text-white transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  aria-disabled={
                    !isComplete || isSubmitting || receiptMutationInProgress
                  }
                  disabled={isSubmitting || receiptMutationInProgress}
                  onClick={() => {
                    if (!isComplete) {
                      setShowIncomplete(true);
                      return;
                    }
                    void handleSubmit(onSubmit)();
                  }}
                  className={`rounded-full bg-moss px-7 py-2.5 font-red-hat text-[13px] font-medium text-white transition-opacity ${
                    !isComplete || isSubmitting || receiptMutationInProgress
                      ? "cursor-not-allowed opacity-50"
                      : "hover:opacity-80"
                  }`}
                >
                  {isSubmitting ? "Submitting…" : "Submit RSVP"}
                </button>
              )}
            </div>

            {receiptMutationInProgress && (
              <p
                className="mt-3 text-right font-red-hat text-xs text-moss/55"
                aria-live="polite"
              >
                Finish the receipt update before continuing.
              </p>
            )}

            {step === steps.length - 1 && showIncomplete && !isComplete && (
              <p
                className="mt-3 text-right font-red-hat text-xs text-destructive"
                role="alert"
              >
                Please complete the required questions before submitting.
              </p>
            )}
          </form>
        </FormProvider>
      </motion.main>
    </RsvpPageShell>
  );
}
