"use client";

import React, { use, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
import { submitHackerApplication } from "@/lib/actions/application-form.server.actions";
import { MHacksLogo } from "@/components/mhacks-logo";

const STORAGE_KEY = "mhacks-application-draft";
const GREEN = "#3A4A26";
const GREEN_BORDER = "rgba(58,74,38,0.15)";

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
    fields: ["whyAttend", "technicalChallenge", "proudProject"],
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
    <div className="w-full px-6 pt-5 pb-4">
      {/* Dots + connecting lines — stretch full width */}
      <div className="flex items-center w-full">
        {STEPS.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <React.Fragment key={i}>
              <div
                className="shrink-0 rounded-full transition-all duration-200"
                style={
                  isActive
                    ? { width: 12, height: 12, background: GREEN, boxShadow: `0 0 0 3px rgba(58,74,38,0.18)` }
                    : isDone
                    ? { width: 9, height: 9, background: GREEN }
                    : { width: 9, height: 9, background: "white", border: "2px solid #D1D5DB" }
                }
              />
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-1 transition-colors duration-200"
                  style={{ backgroundColor: isDone ? GREEN : "#D1D5DB" }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* Labels — each label is centered under its dot via flex-1 + text-center */}
      <div className="flex w-full mt-2">
        {STEPS.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <span
              key={i}
              className="flex-1 text-center text-[11px] transition-colors duration-200 leading-tight"
              style={{
                color: isActive ? GREEN : isDone ? GREEN : "#6B7280",
                fontWeight: isActive ? 700 : isDone ? 600 : 500,
              }}
            >
              {isDone ? "✓ " : ""}{step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function ApplyPage({
  profileIdPromise,
}: {
  profileIdPromise: Promise<string>;
}) {
  const profileId = use(profileIdPromise);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
    defaultValues: {
      age: undefined,
      gender: "",
      genderOther: "",
      ethnicity: "",
      ethnicityOther: "",
      university: "",
      universityOther: "",
      country: "",
      countryOther: "",
      degree: "",
      degreeOther: "",
      graduationYear: undefined,
      previousHackathons: undefined,
      major: "",
      majorOther: "",
      resume: undefined,
      whyAttend: "",
      technicalChallenge: "",
      proudProject: "",
      anythingElse: "",
      transportationType: "",
      comingFrom: "",
      shirtSize: "",
      hasAllergies: false,
      allergiesDescription: "",
      needsTravelReimbursement: false,
      wouldAttendWithoutReimbursement: undefined,
      github: "",
      linkedin: "",
      personalSite: "",
      followsInstagram: false,
      mlhCodeOfConduct: false,
      mlhPrivacyPolicy: false,
      mlhEmails: false,
      sponsorEmails: false,
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            setValue(key as keyof HackerApplicationFormData, value as any);
          }
        });
      } catch (e) {
        console.error("Failed to load saved progress:", e);
      }
    }
  }, [setValue]);

  useEffect(() => {
    const subscription = watch((data) => {
      const toSave = { ...data };
      (Object.keys(toSave) as (keyof HackerApplicationFormData)[]).forEach(
        (key) => {
          if (toSave[key] === undefined) delete toSave[key];
        },
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const saveProgress = () => {
    const data = watch();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const goNext = async () => {
    const fields = STEPS[step].fields;
    if (fields.length > 0) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  };

  const onSubmit = async (data: HackerApplicationFormData) => {
    setIsSubmitting(true);
    try {
      await submitHackerApplication(
        "6fb4e643-baea-4a96-bf9b-4bc863ad760e",
        data,
      );
      localStorage.removeItem(STORAGE_KEY);
      setSubmitSuccess(true);
    } catch (error) {
      console.error("Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[55%] opacity-10">
          <Image src="/white_green_bg.png" alt="" fill className="object-cover object-top" />
        </div>
        <div className="relative text-center max-w-md">
          <MHacksLogo size={48} />
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            MHacks 2026
          </p>
          <h2
            className="mt-3 font-heading italic text-4xl leading-tight tracking-tight"
            style={{ color: GREEN }}
          >
            Application Submitted!
          </h2>
          <p className="mt-4 text-[14px] leading-7 text-zinc-500">
            Thank you for applying to MHacks 2026. We&apos;ll review your
            application and be in touch soon.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-full px-8 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-80"
            style={{ background: GREEN }}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative overflow-x-hidden">
      {/* Subtle background */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-[55%] opacity-[0.07]">
        <Image src="/white_green_bg.png" alt="" fill className="object-cover object-top" />
      </div>

      {/* Decorative flowers — pinned to viewport edges, never overlapping the content column */}
      <Image
        src="/yellow_flower.png"
        alt=""
        width={300}
        height={300}
        className="pointer-events-none absolute -top-8 -left-24 opacity-30 rotate-[-18deg] select-none"
      />
      <Image
        src="/pink_flower.png"
        alt=""
        width={260}
        height={260}
        className="pointer-events-none absolute top-32 -right-20 opacity-25 rotate-[12deg] select-none"
      />
      <Image
        src="/light_blue_flower.png"
        alt=""
        width={240}
        height={240}
        className="pointer-events-none absolute bottom-40 -left-20 opacity-25 rotate-[8deg] select-none"
      />
      <Image
        src="/pink_ascii_flower.png"
        alt=""
        width={220}
        height={220}
        className="pointer-events-none absolute bottom-12 -right-16 opacity-25 rotate-[-10deg] select-none"
      />

      {/* Header */}
      <header className="relative border-b bg-white/80 backdrop-blur-sm" style={{ borderColor: GREEN_BORDER }}>
        <div className="mx-auto max-w-5xl px-8 h-14 flex items-center gap-3">
          <MHacksLogo size={24} />
          <span
            className="font-heading italic text-lg"
            style={{ color: GREEN }}
          >
            MHacks 2026
          </span>
          <span className="text-zinc-200 mx-1">|</span>
          <span className="text-[13px] text-zinc-400 font-medium">
            Hacker Application
          </span>
        </div>
      </header>

      {/* Content — solid white column so flowers never bleed into text/cards */}
      <div className="relative mx-auto max-w-2xl px-6 py-12 bg-white">
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Apply
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        {/* Page title */}
        <h1
          className="font-heading italic text-4xl sm:text-5xl leading-tight tracking-tight mb-8"
          style={{ color: GREEN }}
        >
          {STEPS[step].label}
        </h1>

        {/* Step bar */}
        <div
          className="rounded-2xl bg-white mb-8 border"
          style={{ borderColor: GREEN_BORDER }}
        >
          <StepBar current={step} />
        </div>

        {/* Step content */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-8">
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
              />
            )}
            {step === 2 && <Essays register={register} errors={errors} />}
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
                <Communications control={control} errors={errors} />
              </div>
            )}
            {step === 5 && <Agreements control={control} errors={errors} />}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-full border px-6 py-2.5 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                style={{ borderColor: GREEN_BORDER }}
              >
                Back
              </button>
            )}

            <div className="flex-1" />

            <button
              type="button"
              onClick={saveProgress}
              className="rounded-full border px-6 py-2.5 text-[13px] font-medium transition-colors hover:bg-zinc-50"
              style={{ borderColor: "rgba(58,74,38,0.35)", color: "rgba(58,74,38,0.65)" }}
            >
              Save Progress
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-full px-7 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
                style={{ background: GREEN }}
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full px-7 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: GREEN }}
              >
                {isSubmitting ? "Submitting…" : "Submit Application"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
