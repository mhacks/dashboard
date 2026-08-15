"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import {
  HackerApplicationFormData,
  hackerApplicationSchema,
} from "@/lib/types/applications";

import { FormStepProgress } from "@/components/forms/form-step-progress";
import AcademicInformation from "./components/academic-information";
import PersonalInformation from "./components/personal-information";
import Essays from "./components/essays";
import Logistics from "./components/logistics";
import Socials from "./components/socials";
import Communications from "./components/communications";
import Agreements from "./components/agreements";
import { APPLICATION_STEPS } from "@/lib/application-steps";
import { logout } from "@/lib/actions/auth.server.actions";
import {
  submitHackerApplication,
  saveDraft,
} from "@/lib/actions/application-form.server.actions";
import { HackerApplicantRow } from "@/lib/db/schema/applications";
import { MHacksLogo } from "@/components/mhacks-logo";
import posthog from "posthog-js";
import { ArrowLeft, Bot } from "lucide-react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const EASE = [0.25, 0.1, 0.25, 1] as const;

// Shared with the dashboard, which derives draft progress from the same steps.
const STEPS = APPLICATION_STEPS;

// Maps every schema field to the section (step label) it belongs to, so a
// validation error can be reported as the section that needs completing.
const SECTION_OF_FIELD: Partial<
  Record<keyof HackerApplicationFormData, string>
> = {
  firstName: "Personal",
  lastName: "Personal",
  phoneNumber: "Personal",
  age: "Personal",
  gender: "Personal",
  ethnicity: "Personal",
  university: "Academic",
  country: "Academic",
  degree: "Academic",
  graduationYear: "Academic",
  previousHackathons: "Academic",
  major: "Academic",
  resume: "Academic",
  whatWouldYouDo: "Essays",
  whyMhacks: "Essays",
  hillToDieOn: "Essays",
  transportationType: "Logistics",
  comingFrom: "Logistics",
  airportCode: "Logistics",
  shirtSize: "Logistics",
  allergiesDescription: "Logistics",
  needsTravelReimbursement: "Logistics",
  wouldAttendWithoutReimbursement: "Logistics",
  github: "Socials",
  linkedin: "Socials",
  personalSite: "Socials",
  followsInstagram: "Socials",
  mlhCodeOfConduct: "Agreements",
  mlhPrivacyPolicy: "Agreements",
  mlhEmails: "Agreements",
  sponsorEmails: "Agreements",
  notAiSlop: "Agreements",
};

// Max number of section names to spell out in the "please complete" message
// before collapsing the rest into "and N more".
const MAX_SECTIONS_SHOWN = 3;

function rowToFormData(row: HackerApplicantRow): HackerApplicationFormData {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    phoneNumber: row.phoneNumber,
    age: row.age,
    gender: row.gender,
    ethnicity: row.ethnicity,
    university: row.university,
    country: row.country,
    degree: row.degree,
    graduationYear: row.graduationYear,
    previousHackathons: row.previousHackathons,
    major: row.major,
    resume: row.resume ?? "",
    whatWouldYouDo: row.whatWouldYouDo,
    whyMhacks: row.whyMhacks,
    hillToDieOn: row.hillToDieOn,
    transportationType: row.transportationType,
    comingFrom: row.comingFrom,
    airportCode: row.airportCode ?? "",
    shirtSize: row.shirtSize,
    allergiesDescription: row.allergiesDescription ?? "",
    needsTravelReimbursement: row.needsTravelReimbursement,
    wouldAttendWithoutReimbursement:
      row.wouldAttendWithoutReimbursement ?? undefined,
    github: row.github ?? "",
    linkedin: row.linkedin ?? "",
    personalSite: row.personalSite ?? "",
    followsInstagram: row.followsInstagram ?? false,
    // Not stored in the DB — a submitted application implies acceptance.
    mlhCodeOfConduct: true,
    mlhPrivacyPolicy: true,
    mlhEmails: true,
    sponsorEmails: row.sponsorEmails ?? false,
    notAiSlop: true,
  };
}

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

export default function ApplyPage({
  existingData,
  draftData,
  resumeUrl,
}: {
  existingData: HackerApplicantRow | null;
  draftData: Record<string, unknown> | null;
  resumeUrl: string | null;
}) {
  const readOnly = existingData !== null;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIncompleteMsg, setShowIncompleteMsg] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draft = (draftData ?? {}) as Partial<HackerApplicationFormData>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<HackerApplicationFormData>({
    resolver: zodResolver(hackerApplicationSchema),
    mode: "onChange",
    defaultValues: existingData
      ? rowToFormData(existingData)
      : {
          firstName: draft.firstName ?? "",
          lastName: draft.lastName ?? "",
          phoneNumber: draft.phoneNumber ?? "",
          age: (draft.age as number | undefined) ?? undefined,
          gender: draft.gender ?? "",
          ethnicity: draft.ethnicity ?? "",
          university: draft.university ?? "",
          country: draft.country ?? "",
          degree: draft.degree ?? "",
          graduationYear:
            (draft.graduationYear as number | undefined) ?? undefined,
          previousHackathons:
            (draft.previousHackathons as number | undefined) ?? undefined,
          major: draft.major ?? "",
          resume: draft.resume ?? undefined,
          whatWouldYouDo: draft.whatWouldYouDo ?? "",
          whyMhacks: draft.whyMhacks ?? "",
          hillToDieOn: draft.hillToDieOn ?? "",
          transportationType: draft.transportationType ?? "",
          comingFrom: draft.comingFrom ?? "",
          airportCode: draft.airportCode ?? "",
          shirtSize: draft.shirtSize ?? "",
          allergiesDescription: draft.allergiesDescription ?? "",
          needsTravelReimbursement: draft.needsTravelReimbursement ?? false,
          wouldAttendWithoutReimbursement:
            draft.wouldAttendWithoutReimbursement ?? undefined,
          github: draft.github ?? "",
          linkedin: draft.linkedin ?? "",
          personalSite: draft.personalSite ?? "",
          followsInstagram: draft.followsInstagram ?? false,
          mlhCodeOfConduct: draft.mlhCodeOfConduct ?? false,
          mlhPrivacyPolicy: draft.mlhPrivacyPolicy ?? false,
          mlhEmails: draft.mlhEmails ?? false,
          sponsorEmails: draft.sponsorEmails ?? false,
          notAiSlop: draft.notAiSlop ?? false,
        },
  });

  const scheduleSave = useCallback(
    (data: Partial<HackerApplicationFormData>) => {
      if (readOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaveStatus("saving");
      saveTimer.current = setTimeout(async () => {
        try {
          await saveDraft(data);
          setSaveStatus("saved");
          savedTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
        } catch {
          setSaveStatus("error");
        }
      }, 1500);
    },
    [readOnly],
  );

  useEffect(() => {
    if (readOnly) return;
    // react-hook-form's watch() subscription cannot be memoized by React Compiler.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((data) => {
      scheduleSave(data as Partial<HackerApplicationFormData>);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [watch, scheduleSave, readOnly]);

  // Validate the entire form against the schema on every change so we can both
  // disable the submit button and tell the user which sections are incomplete.
  const watchedValues = watch();
  const incompleteSections = (() => {
    const result = hackerApplicationSchema.safeParse(watchedValues);
    if (result.success) return [];
    const sections = new Set<string>();
    for (const issue of result.error.issues) {
      const section =
        SECTION_OF_FIELD[issue.path[0] as keyof typeof SECTION_OF_FIELD];
      if (section) sections.add(section);
    }
    // Report sections in the order they appear in the form.
    return STEPS.map((s) => s.label).filter((label) => sections.has(label));
  })();
  const isComplete = incompleteSections.length === 0;

  const incompleteMessage = (() => {
    if (isComplete) return "";
    const shown = incompleteSections.slice(0, MAX_SECTIONS_SHOWN);
    const remaining = incompleteSections.length - shown.length;
    let list = shown.join(", ");
    if (remaining > 0) {
      list += `, and ${remaining} more section${remaining === 1 ? "" : "s"}`;
    }
    const noun = incompleteSections.length === 1 ? "section" : "sections";
    return `Please complete the following ${noun} before submitting: ${list}.`;
  })();

  const goNext = async () => {
    if (!readOnly) {
      const fields = STEPS[step].fields;
      if (fields.length > 0) {
        const valid = await trigger(fields);
        if (!valid) return;
      }
    }
    posthog.capture("application_step_completed", {
      step_index: step,
      step_label: STEPS[step].label,
    });
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const onSubmit = async (data: HackerApplicationFormData) => {
    if (step !== STEPS.length - 1 || readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setIsSubmitting(true);
    try {
      const { duplicate, blocked } = await submitHackerApplication(data);
      if (blocked) {
        setIsBlocked(true);
      } else if (duplicate) {
        setIsDuplicate(true);
      } else {
        setSubmitSuccess(true);
      }
    } catch (error) {
      posthog.captureException(error);
      console.error("Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isBlocked || isDuplicate || submitSuccess) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        <Image
          src="/hero_bg_w_overlay.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />

        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-10 -left-16 opacity-20 rotate-[-18deg] hidden md:block"
        >
          <Image src="/yellow_flower.png" alt="" width={300} height={300} />
        </motion.div>
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.2,
          }}
          className="pointer-events-none absolute bottom-10 -right-12 opacity-20 rotate-[-10deg] hidden md:block"
        >
          <Image src="/pink_ascii_flower.png" alt="" width={260} height={260} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="glass-card relative z-10 text-center max-w-md w-full rounded-3xl px-10 py-12"
        >
          <div className="flex justify-center">
            <MHacksLogo size={48} variant="green" />
          </div>
          <h2 className="mt-6 font-heading italic text-4xl leading-tight tracking-tight text-moss">
            {isBlocked
              ? "Application Not Accepted"
              : isDuplicate
                ? "Already Applied!"
                : "Application Submitted!"}
          </h2>
          <p className="mt-4 font-red-hat text-[14px] leading-7 text-moss/65">
            {isBlocked ? (
              <>
                We&apos;re unable to accept an application from you for MHacks
                2026. If you believe this is a mistake, reach out to{" "}
                <a
                  href="mailto:hackathon@mhacks.org"
                  className="underline underline-offset-2 hover:opacity-80"
                >
                  hackathon@mhacks.org
                </a>
                .
              </>
            ) : isDuplicate ? (
              "You've already submitted a hacker application for MHacks 2026. We'll be in touch soon with a decision."
            ) : (
              "Thank you for applying to MHacks 2026. We'll review your application and be in touch soon."
            )}
          </p>
          {/* A blocked applicant has no application to return to. */}
          {!isBlocked && (
            <button
              onClick={() => {
                window.location.href = "/apply";
              }}
              className="mt-8 font-red-hat rounded-full px-8 py-3 text-[14px] font-medium text-white bg-moss transition-opacity hover:opacity-80"
            >
              View Application
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/hero_bg_w_overlay.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      {/* Floating flowers */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-10 -left-20 opacity-[0.18] rotate-[-18deg] select-none hidden md:block"
      >
        <Image src="/yellow_flower.png" alt="" width={360} height={360} />
      </motion.div>
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
        className="pointer-events-none absolute top-24 -right-20 opacity-[0.14] rotate-12 select-none hidden md:block"
      >
        <Image src="/pink_flower.png" alt="" width={300} height={300} />
      </motion.div>
      <motion.div
        animate={{ y: [0, -9, 0] }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8,
        }}
        className="pointer-events-none absolute bottom-28 -left-16 opacity-[0.14] rotate-[8deg] select-none hidden md:block"
      >
        <Image src="/light_blue_flower.png" alt="" width={280} height={280} />
      </motion.div>
      <motion.div
        animate={{ y: [0, -11, 0] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2.2,
        }}
        className="pointer-events-none absolute bottom-6 -right-14 opacity-[0.14] rotate-[-10deg] select-none hidden md:block"
      >
        <Image src="/pink_ascii_flower.png" alt="" width={240} height={240} />
      </motion.div>

      {/* Page content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center py-8 px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-center justify-between w-full max-w-2xl mb-8 gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="glass-pill flex items-center gap-3 rounded-full px-3 py-2.5 sm:px-5">
              <Link
                href="/"
                aria-label="Back to home"
                className="transition-opacity hover:opacity-80"
              >
                <MHacksLogo size={20} />
              </Link>
              <span className="font-heading italic text-[17px] text-white leading-none">
                MHacks 2026
              </span>
            </div>
            <Link
              href="/dashboard"
              className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-2 font-red-hat text-[11px] font-semibold uppercase tracking-widest text-white/55 transition-colors hover:text-white/80 sm:px-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && saveStatus !== "idle" && (
              <span
                className="font-red-hat text-[11px] transition-opacity duration-300"
                style={{
                  color:
                    saveStatus === "error"
                      ? "rgba(220,38,38,0.8)"
                      : "rgba(255,255,255,0.45)",
                }}
              >
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "saved"
                    ? "Saved"
                    : "Failed to save"}
              </span>
            )}
            <div className="glass-pill rounded-full px-4 py-2">
              <span className="font-red-hat text-[11px] font-semibold uppercase tracking-widest text-white/55">
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <button
              type="button"
              disabled={isSigningOut}
              onClick={async () => {
                setIsSigningOut(true);
                await logout();
              }}
              className="glass-pill rounded-full px-4 py-2 font-red-hat text-[11px] font-semibold uppercase tracking-widest text-white/55 transition-colors hover:text-white/80 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: EASE, delay: 0.1 }}
          className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden"
        >
          {/* Card header */}
          <div className="px-8 pt-8 pb-6">
            <div className="mb-6">
              <p className="font-red-hat text-[10px] font-semibold uppercase tracking-[0.3em] mb-1 text-moss/45">
                Apply
              </p>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center flex-wrap gap-3">
                  <h1 className="font-heading italic text-4xl sm:text-5xl leading-tight tracking-tight text-moss">
                    {STEPS[step].label}
                  </h1>
                  <Image
                    src="/yellow_flower.png"
                    alt=""
                    width={68}
                    height={68}
                    className="opacity-30 rotate-[-18deg] pointer-events-none select-none shrink-0"
                  />
                </div>
                <Link
                  href="/how-to-mcp"
                  className="flex shrink-0 items-center gap-1.5 font-red-hat text-[11px] font-semibold uppercase tracking-widest text-white whitespace-nowrap rounded-full bg-moss px-4 py-2 transition-opacity hover:opacity-80"
                >
                  <Bot className="h-3.5 w-3.5" />
                  Apply with an agent →
                </Link>
              </div>
            </div>
            <FormStepProgress
              current={step}
              steps={STEPS}
              label="Application progress"
            />
          </div>

          <div className="h-px mx-8 bg-moss/8" />

          {/* Step content */}
          <div className="px-8 py-7">
            {readOnly && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mb-5 rounded-xl px-4 py-3 font-red-hat text-[13px] font-medium bg-moss/7 text-moss border border-moss/13"
              >
                Your application has been submitted and is under review. No
                further changes can be made.
              </motion.div>
            )}

            <form onSubmit={(e) => e.preventDefault()}>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: EASE }}
                  className={readOnly ? "pointer-events-none select-none" : ""}
                >
                  {step === 0 && (
                    <PersonalInformation
                      register={register}
                      errors={errors}
                      control={control}
                      readOnly={readOnly}
                    />
                  )}
                  {step === 1 && (
                    <AcademicInformation
                      errors={errors}
                      register={register}
                      control={control}
                      setValue={setValue}
                      resumeUrl={resumeUrl}
                    />
                  )}
                  {step === 2 && (
                    <Essays
                      register={register}
                      errors={errors}
                      control={control}
                    />
                  )}
                  {step === 3 && (
                    <Logistics
                      register={register}
                      errors={errors}
                      control={control}
                    />
                  )}
                  {step === 4 && (
                    <div className="space-y-6">
                      <Socials register={register} errors={errors} />
                      <Communications control={control} />
                    </div>
                  )}
                  {step === 5 && (
                    <Agreements control={control} errors={errors} />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-moss/8">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="font-red-hat rounded-full border border-moss/20 px-6 py-2.5 text-[13px] font-medium text-moss transition-colors hover:bg-black/5"
                  >
                    Back
                  </button>
                )}
                <div className="flex-1" />
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="font-red-hat rounded-full px-7 py-2.5 text-[13px] font-medium text-white bg-moss transition-opacity hover:opacity-80"
                  >
                    Continue
                  </button>
                ) : readOnly ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(-1);
                      setStep(0);
                    }}
                    className="font-red-hat rounded-full px-7 py-2.5 text-[13px] font-medium text-white bg-moss transition-opacity hover:opacity-80"
                  >
                    Back to Start
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-disabled={!isComplete || isSubmitting}
                    onClick={() => {
                      if (isSubmitting) return;
                      if (!isComplete) {
                        setShowIncompleteMsg(true);
                        return;
                      }
                      handleSubmit(onSubmit)();
                    }}
                    className={`font-red-hat rounded-full px-7 py-2.5 text-[13px] font-medium text-white bg-moss transition-opacity ${
                      !isComplete || isSubmitting
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:opacity-80"
                    }`}
                  >
                    {isSubmitting ? "Submitting…" : "Submit Application"}
                  </button>
                )}
              </div>

              {!readOnly &&
                step === STEPS.length - 1 &&
                showIncompleteMsg &&
                !isComplete && (
                  <p
                    className="mt-3 text-right font-red-hat text-[7px] font-medium"
                    style={{ color: "rgba(220,38,38,0.9)" }}
                  >
                    {incompleteMessage}
                  </p>
                )}
            </form>
          </div>
        </motion.div>

        <div className="h-12 shrink-0" />
      </div>
    </div>
  );
}
