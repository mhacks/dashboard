"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import {
  applicationSchema,
  type ApplicationFormData,
} from "@/lib/schemas/application";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AcademicInformation from "./components/academic-information";
import PersonalInformation from "./components/personal-information";
import Essays from "./components/essays";
import Logistics from "./components/logistics";
import Socials from "./components/socials";
import Communications from "./components/communications";

const STORAGE_KEY = "mhacks-application-draft";

export default function ApplyPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
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

  // Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            setValue(key as keyof ApplicationFormData, value as any);
          }
        });
      } catch (e) {
        console.error("Failed to load saved progress:", e);
      }
    }
  }, [setValue]);

  // Save progress on change
  useEffect(() => {
    const subscription = watch((data) => {
      const toSave = { ...data };
      // Don't save undefined values
      Object.keys(toSave).forEach((key) => {
        if (toSave[key as keyof ApplicationFormData] === undefined) {
          delete toSave[key as keyof ApplicationFormData];
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const onSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true);
    try {
      // Dummy resume upload function
      const uploadResume = async (file: File): Promise<string> => {
        // TODO: Implement S3 upload
        console.log("Uploading resume:", file.name);
        return "dummy-resume-url";
      };

      // In a real app, we'd upload the resume here
      console.log("Submitting application:", data);
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
      <div className="container mx-auto max-w-3xl py-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Application Submitted!</CardTitle>
            <CardDescription>
              Thank you for applying to MHacks. We&apos;ll be in touch soon.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push("/")}>Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">MHacks Application</h1>
        <p className="text-muted-foreground mt-2">
          Fill out the form below to apply for MHacks
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Personal Information */}
        <PersonalInformation
          register={register}
          errors={errors}
          control={control}
        />

        {/* Academic Inforamtion */}
        <AcademicInformation
          errors={errors}
          register={register}
          control={control}
          setValue={setValue}
        />

        {/* Essays */}
        <Essays register={register} errors={errors} />

        {/* Logistics */}
        <Logistics
          register={register}
          errors={errors}
          control={control}
        />

        {/* Socials */}
        <Socials register={register} errors={errors} />

        {/* Communications */}
        <Communications control={control} errors={errors} />

        {/* MLH & Sponsor Agreements */}
        <Card>
          <CardHeader>
            <CardTitle>MLH & Sponsor Agreements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <Controller
                name="mlhCodeOfConduct"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="mlhCodeOfConduct"
                  />
                )}
              />
              <Label
                htmlFor="mlhCodeOfConduct"
                className="text-sm leading-normal cursor-pointer"
              >
                I have read and agree to the MLH Code of Conduct
                <span className="text-destructive"> *</span>
              </Label>
            </div>
            {errors.mlhCodeOfConduct && (
              <p className="text-sm text-destructive">
                {errors.mlhCodeOfConduct.message}
              </p>
            )}

            <div className="flex items-start gap-2">
              <Controller
                name="mlhPrivacyPolicy"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="mlhPrivacyPolicy"
                  />
                )}
              />
              <Label
                htmlFor="mlhPrivacyPolicy"
                className="text-sm leading-normal cursor-pointer"
              >
                I authorize you to share my application/registration information
                with Major League Hacking for event administration, ranking, and
                MLH administration in-line with the MLH Privacy Policy. I
                further agree to the terms of both the MLH Contest Terms and
                Conditions and the MLH Privacy Policy
                <span className="text-destructive"> *</span>
              </Label>
            </div>
            {errors.mlhPrivacyPolicy && (
              <p className="text-sm text-destructive">
                {errors.mlhPrivacyPolicy.message}
              </p>
            )}

            <div className="flex items-start gap-2">
              <Controller
                name="mlhEmails"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="mlhEmails"
                  />
                )}
              />
              <Label
                htmlFor="mlhEmails"
                className="text-sm leading-normal cursor-pointer"
              >
                I authorize MLH to send me occasional emails about relevant
                events, career opportunities, and community announcements
                <span className="text-destructive"> *</span>
              </Label>
            </div>
            {errors.mlhEmails && (
              <p className="text-sm text-destructive">
                {errors.mlhEmails.message}
              </p>
            )}

            <div className="flex items-start gap-2">
              <Controller
                name="sponsorEmails"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="sponsorEmails"
                  />
                )}
              />
              <Label
                htmlFor="sponsorEmails"
                className="text-sm leading-normal cursor-pointer"
              >
                I agree to receive emails from event sponsors about relevant
                opportunities and updates (optional)
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => localStorage.removeItem(STORAGE_KEY)}
          >
            Clear Saved Progress
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </form>
    </div>
  );
}
