"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import {
  HackerApplicationFormData,
  hackerApplicationSchema,
} from "@/lib/types/applications";

import AcademicInformation from "./components/academic-information";
import PersonalInformation from "./components/personal-information";
import Essays from "./components/essays";
import Logistics from "./components/logistics";
import Socials from "./components/socials";
import Communications from "./components/communications";
import Agreements from "./components/agreements";
import {
  submitHackerApplication,
  saveDraft,
} from "@/lib/actions/application-form.server.actions";
import { createClient } from "@/lib/supabase/client";
import { HackerApplicantRow } from "@/lib/db/schema/applications";
import { MHacksLogo } from "@/components/mhacks-logo";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const EASE = [0.25, 0.1, 0.25, 1] as const;
const GREEN = "#3A4A26";

const GLASS_CARD =
  "border border-white/30 bg-[#f4f2e8]/[0.88] shadow-[0_24px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl";
const GLASS_PILL =
  "border border-white/20 bg-black/[0.32] shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl";

const STEPS: Array<{
  label: string;
  fields: (keyof HackerApplicationFormData)[];
}> = [
  { label: "Personal", fields: ["age", "gender", "ethnicity"] },
  {
    label: "Academic",
    fields: [
      "university",
      "country",
      "degree",
      "graduationYear",
      "previousHackathons",
      "major",
    ],
  },
  {
    label: "Essays",
    fields: ["whatWouldYouDo", "whyMhacks", "hillToDieOn"],
  },
  {
    label: "Logistics",
    fields: ["transportationType", "comingFrom", "shirtSize"],
  },
  { label: "Socials", fields: [] },
  {
    label: "Agreements",
    fields: ["mlhCodeOfConduct", "mlhPrivacyPolicy", "mlhEmails"],
  },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center w-full">
        {STEPS.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <React.Fragment key={i}>
              <motion.div
                animate={isActive ? { scale: 1.3 } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className="rounded-full shrink-0"
                style={
                  isActive
                    ? {
                        width: 10,
                        height: 10,
                        background: GREEN,
                        boxShadow: `0 0 0 3px rgba(58,74,38,0.2)`,
                      }
                    : isDone
                      ? { width: 8, height: 8, background: GREEN }
                      : {
                          width: 8,
                          height: 8,
                          background: "rgba(58,74,38,0.15)",
                          border: "1.5px solid rgba(58,74,38,0.25)",
                        }
                }
              />
              {i < STEPS.length - 1 && (
                <motion.div
                  className="flex-1 h-px mx-1"
                  animate={{
                    backgroundColor: isDone ? GREEN : "rgba(58,74,38,0.15)",
                  }}
                  transition={{ duration: 0.4 }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex w-full mt-2">
        {STEPS.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <span
              key={i}
              className="flex-1 text-center text-[10px] tracking-wide transition-all duration-300 leading-tight font-red-hat"
              style={{
                color: isActive
                  ? GREEN
                  : isDone
                    ? "rgba(58,74,38,0.65)"
                    : "rgba(58,74,38,0.3)",
                fontWeight: isActive ? 700 : isDone ? 600 : 400,
              }}
            >
              {isDone ? "✓ " : ""}
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function rowToFormData(row: HackerApplicantRow): HackerApplicationFormData {
  return {
    age: row.age,
    gender: row.gender,
    genderOther: row.genderOther ?? "",
    ethnicity: row.ethnicity,
    ethnicityOther: row.ethnicityOther ?? "",
    university: row.university,
    universityOther: row.universityOther ?? "",
    country: row.country,
    countryOther: row.countryOther ?? "",
    degree: row.degree,
    degreeOther: row.degreeOther ?? "",
    graduationYear: row.graduationYear,
    previousHackathons: row.previousHackathons,
    major: row.major,
    majorOther: row.majorOther ?? "",
    resume: row.resume ?? undefined,
    whatWouldYouDo: row.whatWouldYouDo,
    whyMhacks: row.whyMhacks,
    hillToDieOn: row.hillToDieOn,
    transportationType: row.transportationType,
    comingFrom: row.comingFrom,
    airportCode: row.airportCode ?? "",
    shirtSize: row.shirtSize,
    hasAllergies: row.hasAllergies,
    allergiesDescription: row.allergiesDescription ?? "",
    needsTravelReimbursement: row.needsTravelReimbursement,
    wouldAttendWithoutReimbursement:
      row.wouldAttendWithoutReimbursement ?? undefined,
    github: row.github ?? "",
    linkedin: row.linkedin ?? "",
    personalSite: row.personalSite ?? "",
    followsInstagram: row.followsInstagram ?? false,
    mlhCodeOfConduct: row.mlhCodeOfConduct,
    mlhPrivacyPolicy: row.mlhPrivacyPolicy,
    mlhEmails: row.mlhEmails,
    sponsorEmails: row.sponsorEmails ?? false,
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
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
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
          age: (draft.age as number | undefined) ?? undefined,
          gender: draft.gender ?? "",
          genderOther: draft.genderOther ?? "",
          ethnicity: draft.ethnicity ?? "",
          ethnicityOther: draft.ethnicityOther ?? "",
          university: draft.university ?? "",
          universityOther: draft.universityOther ?? "",
          country: draft.country ?? "",
          countryOther: draft.countryOther ?? "",
          degree: draft.degree ?? "",
          degreeOther: draft.degreeOther ?? "",
          graduationYear:
            (draft.graduationYear as number | undefined) ?? undefined,
          previousHackathons:
            (draft.previousHackathons as number | undefined) ?? undefined,
          major: draft.major ?? "",
          majorOther: draft.majorOther ?? "",
          resume: draft.resume ?? undefined,
          whatWouldYouDo: draft.whatWouldYouDo ?? "",
          whyMhacks: draft.whyMhacks ?? "",
          hillToDieOn: draft.hillToDieOn ?? "",
          transportationType: draft.transportationType ?? "",
          comingFrom: draft.comingFrom ?? "",
          airportCode: draft.airportCode ?? "",
          shirtSize: draft.shirtSize ?? "",
          hasAllergies: draft.hasAllergies ?? false,
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
    const subscription = watch((data) => {
      scheduleSave(data as Partial<HackerApplicationFormData>);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [watch, scheduleSave, readOnly]);

  const goNext = async () => {
    if (!readOnly) {
      const fields = STEPS[step].fields;
      if (fields.length > 0) {
        const valid = await trigger(fields);
        if (!valid) return;
      }
    }
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
      const { duplicate } = await submitHackerApplication(data);
      if (duplicate) {
        setIsDuplicate(true);
      } else {
        setSubmitSuccess(true);
      }
    } catch (error) {
      console.error("Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDuplicate || submitSuccess) {
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
          className={`relative z-10 text-center max-w-md w-full rounded-3xl px-10 py-12 ${GLASS_CARD}`}
        >
          <MHacksLogo size={48} />
          <p
            className="mt-6 font-red-hat text-[11px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: "rgba(58,74,38,0.55)" }}
          >
            MHacks 2026
          </p>
          <h2
            className="mt-3 font-heading italic text-4xl leading-tight tracking-tight"
            style={{ color: GREEN }}
          >
            {isDuplicate ? "Already Applied!" : "Application Submitted!"}
          </h2>
          <p
            className="mt-4 font-red-hat text-[14px] leading-7"
            style={{ color: "rgba(58,74,38,0.65)" }}
          >
            {isDuplicate
              ? "You've already submitted a hacker application for MHacks 2026. We'll be in touch soon with a decision."
              : "Thank you for applying to MHacks 2026. We'll review your application and be in touch soon."}
          </p>
          <button
            onClick={() => {
              window.location.href = "/apply";
            }}
            className="mt-8 font-red-hat rounded-full px-8 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-80"
            style={{ background: GREEN }}
          >
            View Application
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background */}
      <Image
        src="/hero_bg_w_overlay.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-black/55" />

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
          className="flex items-center justify-between w-full max-w-2xl mb-8"
        >
          <div
            className={`flex items-center gap-3 rounded-full px-5 py-2.5 ${GLASS_PILL}`}
          >
            <MHacksLogo size={20} />
            <span className="font-heading italic text-[17px] text-white leading-none">
              MHacks 2026
            </span>
            <span className="text-white/25 mx-0.5">|</span>
            <span className="font-red-hat text-[12px] text-white/55">
              Hacker Application
            </span>
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
            <div className={`rounded-full px-4 py-2 ${GLASS_PILL}`}>
              <span className="font-red-hat text-[11px] font-semibold uppercase tracking-widest text-white/55">
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <button
              type="button"
              disabled={isSigningOut}
              onClick={async () => {
                setIsSigningOut(true);
                await createClient().auth.signOut().catch(() => {});
                router.push("/");
              }}
              className={`rounded-full px-4 py-2 font-red-hat text-[11px] font-semibold uppercase tracking-widest text-white/55 transition-colors hover:text-white/80 disabled:opacity-50 ${GLASS_PILL}`}
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
          className={`w-full max-w-2xl rounded-3xl overflow-hidden ${GLASS_CARD}`}
        >
          {/* Card header */}
          <div className="px-8 pt-8 pb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p
                  className="font-red-hat text-[10px] font-semibold uppercase tracking-[0.3em] mb-1"
                  style={{ color: "rgba(58,74,38,0.45)" }}
                >
                  Apply
                </p>
                <h1
                  className="font-heading italic text-4xl sm:text-5xl leading-tight tracking-tight"
                  style={{ color: GREEN }}
                >
                  {STEPS[step].label}
                </h1>
              </div>
              <Image
                src="/yellow_flower.png"
                alt=""
                width={68}
                height={68}
                className="opacity-30 rotate-[-18deg] pointer-events-none select-none shrink-0 mt-1"
              />
            </div>
            <StepBar current={step} />
          </div>

          <div
            className="h-px mx-8"
            style={{ background: "rgba(58,74,38,0.08)" }}
          />

          {/* Step content */}
          <div className="px-8 py-7">
            {readOnly && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mb-5 rounded-xl px-4 py-3 font-red-hat text-[13px] font-medium"
                style={{
                  background: "rgba(58,74,38,0.07)",
                  color: GREEN,
                  border: "1px solid rgba(58,74,38,0.13)",
                }}
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
              <div
                className="flex items-center gap-3 mt-8 pt-6 border-t"
                style={{ borderColor: "rgba(58,74,38,0.08)" }}
              >
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="font-red-hat rounded-full border px-6 py-2.5 text-[13px] font-medium transition-colors hover:bg-black/5"
                    style={{
                      borderColor: "rgba(58,74,38,0.2)",
                      color: GREEN,
                    }}
                  >
                    Back
                  </button>
                )}
                <div className="flex-1" />
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="font-red-hat rounded-full px-7 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
                    style={{ background: GREEN }}
                  >
                    Continue
                  </button>
                ) : readOnly ? (
                  <button
                    type="button"
                    onClick={() => router.push("/apply")}
                    className="font-red-hat rounded-full px-7 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
                    style={{ background: GREEN }}
                  >
                    View Application
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                    className="font-red-hat rounded-full px-7 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
                    style={{ background: GREEN }}
                  >
                    {isSubmitting ? "Submitting…" : "Submit Application"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </motion.div>

        <div className="h-12 shrink-0" />
      </div>
    </div>
  );
}
