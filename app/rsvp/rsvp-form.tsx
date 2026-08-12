"use client";

import { useEffect, useState } from "react";
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

import { Button } from "@/components/ui/button";
import {
  saveRsvpDraftWithoutReceipt,
  submitRsvp,
} from "@/lib/actions/rsvp.server.actions";
import {
  rsvpFormSchema,
  type RsvpDraftData,
  type RsvpFormData,
} from "@/lib/types/rsvps";
import { RSVP_STEPS } from "./form-options";
import { RsvpPageShell } from "./rsvp-page-shell";
import { RsvpSummary } from "./rsvp-summary";
import { PersonalStep, TravelTaxStep, WaiversStep } from "./rsvp-steps";
import {
  consumeRestorablePendingRsvp,
  useRsvpAutosave,
} from "./use-rsvp-autosave";

function defaultValues(
  draft: RsvpDraftData,
  accountEmail: string,
): DefaultValues<RsvpFormData> {
  const hasDraftEmail = Object.prototype.hasOwnProperty.call(draft, "email");
  return {
    legalName: draft.legalName ?? "",
    preferredName: draft.preferredName ?? "",
    email: hasDraftEmail ? (draft.email ?? "") : accountEmail,
    emailMatchesApplication: draft.emailMatchesApplication ?? false,
    incorrectEmailRiskAcknowledged:
      draft.incorrectEmailRiskAcknowledged ?? false,
    dietaryRestrictions: draft.dietaryRestrictions ?? [],
    otherDietaryRestriction: draft.otherDietaryRestriction,
    tshirtSize: draft.tshirtSize,
    travelPlan: draft.travelPlan,
    travelGuideAcknowledged: draft.travelGuideAcknowledged,
    flightBooked: draft.flightBooked,
    receipt: draft.receipt,
    receiptBindingAcknowledged: draft.receiptBindingAcknowledged,
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

function StepProgress({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="RSVP progress">
      {RSVP_STEPS.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <li key={step.label} className="flex min-w-0 flex-col gap-2">
            <div
              className={
                done || active
                  ? "h-1 rounded-full bg-moss"
                  : "h-1 rounded-full bg-moss/15"
              }
            />
            <span
              className={
                active
                  ? "truncate text-center font-red-hat text-[10px] font-bold text-moss"
                  : "truncate text-center font-red-hat text-[10px] text-moss/45"
              }
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓ " : ""}
              {step.shortLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
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
    <div
      className="glass-pill flex items-center gap-2 rounded-full px-3 py-2"
      aria-live="polite"
    >
      <span
        className={
          status === "error"
            ? "font-red-hat text-[11px] text-red-200"
            : "font-red-hat text-[11px] text-white/60"
        }
      >
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : "Failed to save"}
      </span>
      {status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          className="font-red-hat text-[11px] font-semibold text-white underline underline-offset-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default function RsvpForm({
  accountId,
  draft,
  accountEmail,
  draftVersion,
  receiptVersion: initialReceiptVersion,
}: {
  accountId: string;
  draft: RsvpDraftData;
  accountEmail: string;
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
    defaultValues: defaultValues(draft, accountEmail),
  });
  const { control, watch, trigger, handleSubmit, reset } = methods;
  const watchedValues = useWatch({ control }) as RsvpDraftData;
  const completeResult = rsvpFormSchema.safeParse(watchedValues);
  const isComplete = completeResult.success;

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
    reset(defaultValues(pending, accountEmail));
    scheduleSave(pending);
  }, [accountEmail, accountId, draft, reset, scheduleSave]);

  const goNext = async () => {
    if (receiptMutationInProgress) return;
    const fields = RSVP_STEPS[step].fields;
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
    if (step !== RSVP_STEPS.length - 1 || receiptMutationInProgress) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      scheduleSave(values);
      await flushSave();
      const result = await submitRsvp({
        data: values,
        expectedReceiptVersion: receiptVersion,
      });
      stopAutosave();
      if (result.alreadySubmitted) {
        window.location.assign("/rsvp");
        return;
      }
      setSubmitted({
        values,
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
    >
      <main className="glass-card w-full max-w-2xl overflow-hidden rounded-3xl">
        <div className="px-5 pt-7 pb-6 sm:px-8 sm:pt-8">
          <p className="font-red-hat text-[10px] font-semibold tracking-[0.3em] text-moss/45 uppercase">
            RSVP
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-4xl leading-tight italic text-moss sm:text-5xl">
                MHacks 2026 Early Application RSVP
              </h1>
              <p className="mt-3 font-red-hat text-sm leading-6 text-moss/65">
                Please complete this form by August 14th to confirm your spot at
                MHacks 2026. We&apos;re so excited to have you here !!
              </p>
            </div>
            <Image
              src="/yellow_flower.png"
              alt=""
              width={68}
              height={68}
              className="pointer-events-none hidden shrink-0 rotate-[-18deg] opacity-30 select-none sm:block"
            />
          </div>
          <div className="mt-4 rounded-xl border border-moss/10 bg-white/30 px-4 py-3">
            <p className="font-red-hat text-xs leading-5 text-moss/60">
              Your signed-in MHacks account will be associated with uploaded
              files and this submission.
            </p>
            <p className="mt-1 font-red-hat text-xs text-moss/60">
              <span className="text-destructive">*</span> Indicates a required
              question
            </p>
          </div>
          <div className="mt-6">
            <StepProgress current={step} />
          </div>
        </div>

        <div className="h-px bg-moss/8" />

        <FormProvider {...methods}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="px-5 py-6 sm:px-8 sm:py-7"
          >
            <div className="mb-5">
              <p className="font-red-hat text-[10px] font-semibold tracking-[0.25em] text-moss/45 uppercase">
                Step {step + 1} of {RSVP_STEPS.length}
              </p>
              <h2 className="mt-1 font-heading text-3xl italic text-moss">
                {RSVP_STEPS[step].label}
              </h2>
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, x: 24 * direction }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, x: -24 * direction }
                }
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                {step === 0 && <PersonalStep />}
                {step === 1 && (
                  <TravelTaxStep
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
                {step === 2 && <WaiversStep />}
                {step === 3 && (
                  <RsvpSummary
                    values={watchedValues}
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={receiptMutationInProgress}
                  onClick={goBack}
                >
                  Back
                </Button>
              )}
              <div className="flex-1" />
              {step < RSVP_STEPS.length - 1 ? (
                <Button
                  type="button"
                  disabled={receiptMutationInProgress}
                  onClick={goNext}
                >
                  Continue
                </Button>
              ) : (
                <Button
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
                >
                  {isSubmitting ? "Submitting…" : "Submit RSVP"}
                </Button>
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

            {step === RSVP_STEPS.length - 1 &&
              showIncomplete &&
              !isComplete && (
                <p
                  className="mt-3 text-right font-red-hat text-xs text-destructive"
                  role="alert"
                >
                  Please complete the required questions before submitting.
                </p>
              )}
          </form>
        </FormProvider>
      </main>
    </RsvpPageShell>
  );
}
