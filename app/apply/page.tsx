"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

import {
  applicationSchema,
  type ApplicationFormData,
} from "@/lib/schemas/application";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  countries,
  degreeOptions,
  ethnicityOptions,
  majorOptions,
  shirtSizeOptions,
  transportationOptions,
  universities,
} from "./form-options";
import AcademicInformation from "./components/academic-information";
import { FormField } from "./utils";

const STORAGE_KEY = "mhacks-application-draft";

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other (please describe)" },
];

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 10 }, (_, i) => currentYear + i);

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

  const hasAllergies = watch("hasAllergies");
  const needsTravelReimbursement = watch("needsTravelReimbursement");
  const gender = watch("gender");
  const ethnicity = watch("ethnicity");
  const university = watch("university");
  const country = watch("country");
  const degree = watch("degree");
  const major = watch("major");

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
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Age" required>
                <Input
                  type="number"
                  min={18}
                  {...register("age", { valueAsNumber: true })}
                  placeholder="18"
                />
                {errors.age && (
                  <p className="text-sm text-destructive">
                    {errors.age.message}
                  </p>
                )}
              </FormField>

              <FormField label="Gender" required>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.gender && (
                  <p className="text-sm text-destructive">
                    {errors.gender.message}
                  </p>
                )}
              </FormField>
            </div>

            {gender === "other" && (
              <FormField label="Please describe your gender">
                <Input
                  {...register("genderOther")}
                  placeholder="Describe your gender"
                />
              </FormField>
            )}

            <FormField label="Ethnicity" required>
              <Controller
                name="ethnicity"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ethnicity" />
                    </SelectTrigger>
                    <SelectContent>
                      {ethnicityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.ethnicity && (
                <p className="text-sm text-destructive">
                  {errors.ethnicity.message}
                </p>
              )}
            </FormField>

            {ethnicity === "multiracial" && (
              <FormField label="Please describe your ethnicity">
                <Input
                  {...register("ethnicityOther")}
                  placeholder="Describe your ethnicity"
                />
              </FormField>
            )}
          </CardContent>
        </Card>

        {/* Academic Inforamtion */}
        <AcademicInformation />

        {/* Essays */}
        <Card>
          <CardHeader>
            <CardTitle>Essays</CardTitle>
            <CardDescription>
              Please write 100-1000 characters for each response
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Why do you want to attend MHacks?" required>
              <Textarea
                {...register("whyAttend")}
                placeholder="Tell us why you want to attend MHacks..."
                rows={4}
              />
              {errors.whyAttend && (
                <p className="text-sm text-destructive">
                  {errors.whyAttend.message}
                </p>
              )}
            </FormField>

            <FormField
              label="Describe a technical challenge you've faced and how you solved it."
              required
            >
              <Textarea
                {...register("technicalChallenge")}
                placeholder="Describe a technical challenge..."
                rows={4}
              />
              {errors.technicalChallenge && (
                <p className="text-sm text-destructive">
                  {errors.technicalChallenge.message}
                </p>
              )}
            </FormField>

            <FormField
              label="Tell us about a project you're proud of."
              required
            >
              <Textarea
                {...register("proudProject")}
                placeholder="Tell us about a project you're proud of..."
                rows={4}
              />
              {errors.proudProject && (
                <p className="text-sm text-destructive">
                  {errors.proudProject.message}
                </p>
              )}
            </FormField>

            <FormField label="Anything else you'd like us to know? (optional)">
              <Textarea
                {...register("anythingElse")}
                placeholder="Anything else..."
                rows={3}
              />
              {errors.anythingElse && (
                <p className="text-sm text-destructive">
                  {errors.anythingElse.message}
                </p>
              )}
            </FormField>
          </CardContent>
        </Card>

        {/* Logistics */}
        <Card>
          <CardHeader>
            <CardTitle>Logistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Transportation Type" required>
                <Controller
                  name="transportationType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select transportation" />
                      </SelectTrigger>
                      <SelectContent>
                        {transportationOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.transportationType && (
                  <p className="text-sm text-destructive">
                    {errors.transportationType.message}
                  </p>
                )}
              </FormField>

              <FormField label="Where Are You Coming From?" required>
                <Input {...register("comingFrom")} placeholder="City, State" />
                {errors.comingFrom && (
                  <p className="text-sm text-destructive">
                    {errors.comingFrom.message}
                  </p>
                )}
              </FormField>

              <FormField label="Shirt Size" required>
                <Controller
                  name="shirtSize"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {shirtSizeOptions.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.shirtSize && (
                  <p className="text-sm text-destructive">
                    {errors.shirtSize.message}
                  </p>
                )}
              </FormField>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Controller
                  name="hasAllergies"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="hasAllergies"
                    />
                  )}
                />
                <Label htmlFor="hasAllergies">
                  Do you have any allergies or dietary restrictions?
                </Label>
              </div>
              {hasAllergies && (
                <FormField label="Please describe">
                  <Textarea
                    {...register("allergiesDescription")}
                    placeholder="Describe your allergies or dietary restrictions..."
                    rows={2}
                  />
                </FormField>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Controller
                  name="needsTravelReimbursement"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="needsTravelReimbursement"
                    />
                  )}
                />
                <Label htmlFor="needsTravelReimbursement">
                  Will you require travel reimbursement?
                </Label>
              </div>
              {needsTravelReimbursement && (
                <FormField label="If travel reimbursement cannot be provided, would you still attend?">
                  <Controller
                    name="wouldAttendWithoutReimbursement"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(val) => field.onChange(val === "true")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Socials */}
        <Card>
          <CardHeader>
            <CardTitle>Socials</CardTitle>
            <CardDescription>Optional: Share your social links</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="GitHub (optional)">
              <Input
                {...register("github")}
                placeholder="https://github.com/username"
              />
              {errors.github && (
                <p className="text-sm text-destructive">
                  {errors.github.message}
                </p>
              )}
            </FormField>

            <FormField label="LinkedIn (optional)">
              <Input
                {...register("linkedin")}
                placeholder="https://linkedin.com/in/username"
              />
              {errors.linkedin && (
                <p className="text-sm text-destructive">
                  {errors.linkedin.message}
                </p>
              )}
            </FormField>

            <FormField label="Personal Site (optional)">
              <Input
                {...register("personalSite")}
                placeholder="https://yourwebsite.com"
              />
              {errors.personalSite && (
                <p className="text-sm text-destructive">
                  {errors.personalSite.message}
                </p>
              )}
            </FormField>
          </CardContent>
        </Card>

        {/* Communications */}
        <Card>
          <CardHeader>
            <CardTitle>Communications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Controller
                name="followsInstagram"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="followsInstagram"
                  />
                )}
              />
              <Label htmlFor="followsInstagram">
                Did you follow us on Instagram (@mhacks_)? (optional)
              </Label>
            </div>
          </CardContent>
        </Card>

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
