"use client";

import { use, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

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
const PRIMARY = "#1F51A6";

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
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "20px 16px 16px",
        overflowX: "auto",
      }}
    >
      {STEPS.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: i <= current ? PRIMARY : "white",
                border: `2px solid ${i <= current ? PRIMARY : "#D1D9EF"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: i <= current ? "white" : "#9CA3AF",
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: i === current ? 600 : 400,
                color:
                  i === current ? PRIMARY : i < current ? "#6B7280" : "#9CA3AF",
                whiteSpace: "nowrap",
              }}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              style={{
                height: 2,
                width: 40,
                margin: "15px 4px 0",
                background: i < current ? PRIMARY : "#D1D9EF",
                flexShrink: 0,
              }}
            />
          )}
        </div>
      ))}
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
      await submitHackerApplication(profileId, data);
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
      <div
        style={{
          minHeight: "100vh",
          background: "#F0F4FB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: "48px 40px",
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(31,81,166,0.12)",
          }}
        >
          <MHacksLogo size={48} />
          <h2
            style={{
              fontFamily: '"Red Hat Display", system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 24,
              color: "#111",
              margin: "16px 0 8px",
            }}
          >
            Application Submitted!
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#6B7280",
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            Thank you for applying to MHacks 2026. We&apos;ll review your
            application and be in touch soon.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{
              background: PRIMARY,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4FB" }}>
      {/* Header */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #E8EDF7",
          padding: "0 32px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <MHacksLogo size={26} />
        <span
          style={{
            fontFamily: '"Red Hat Display", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 17,
            color: PRIMARY,
          }}
        >
          MHacks 2026
        </span>
        <span style={{ color: "#D1D9EF", margin: "0 2px" }}>|</span>
        <span
          style={{
            fontFamily: '"Red Hat Text", system-ui, sans-serif',
            fontSize: 15,
            color: "#6B7280",
          }}
        >
          Apply
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px" }}>
        {/* Progress bar card */}
        <div
          style={{
            background: "white",
            borderRadius: 12,
            marginBottom: 20,
            boxShadow: "0 1px 4px rgba(31,81,166,0.08)",
          }}
        >
          <StepBar current={step} />
        </div>

        {/* Step title */}
        <div style={{ marginBottom: 14, paddingLeft: 2 }}>
          <h1
            style={{
              fontFamily: '"Red Hat Display", system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 20,
              color: "#111",
              margin: 0,
            }}
          >
            {STEPS[step].label}
          </h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        {/* Step content */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: 20 }}>
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
              <Logistics register={register} errors={errors} control={control} />
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                style={{
                  background: "white",
                  color: "#374151",
                  border: "1px solid #D1D9EF",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}

            <div style={{ flex: 1 }} />

            <button
              type="button"
              onClick={saveProgress}
              style={{
                background: "transparent",
                color: "#6B7280",
                border: "1px solid #D1D9EF",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Save Progress
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                style={{
                  background: PRIMARY,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: isSubmitting ? "#9CA3AF" : PRIMARY,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
