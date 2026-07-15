import { useState } from "react";
import {
  Controller,
  useWatch,
  UseFormRegister,
  FieldErrors,
  Control,
  UseFormSetValue,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { countries, degreeOptions, majorOptions } from "../form-options";
import { FormField } from "../utils";
import { SelectWithOther } from "./select-with-other";
import { UniversitySearch } from "./university-search";
import { HackerApplicationFormData } from "@/lib/types/applications";
import {
  getResumeDownloadUrl,
  uploadResume,
} from "@/lib/actions/resume.server.actions";

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 10 }, (_, i) => currentYear + i);

const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10 MB — mirrors the upload API limit

const countryValueForUniversity = (country: string) =>
  countries.find(
    (option) => option.label.toLowerCase() === country.toLowerCase(),
  )?.value ?? country;

type UploadState = "idle" | "uploading" | "done" | "error";

const AcademicInformation = ({
  errors,
  register,
  control,
  setValue,
  resumeUrl,
}: {
  errors: FieldErrors<HackerApplicationFormData>;
  register: UseFormRegister<HackerApplicationFormData>;
  control: Control<HackerApplicationFormData>;
  setValue: UseFormSetValue<HackerApplicationFormData>;
  resumeUrl: string | null;
}) => {
  const resume = useWatch({ control, name: "resume" });
  const [justUploaded, setJustUploaded] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>(
    resume ? "done" : "idle",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  // URL for a resume just uploaded this session; falls back to the server-rendered
  // resumeUrl (for resumes already on file at page load).
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const previewUrl = uploadedUrl ?? resumeUrl;
  return (
    <>
      {" "}
      {/* Academic Information */}
      <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="University" required>
              <Controller
                name="university"
                control={control}
                render={({ field }) => (
                  <UniversitySearch
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onSelectUniversity={(university) => {
                      setValue(
                        "country",
                        countryValueForUniversity(university.country),
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        },
                      );
                    }}
                    placeholder="Search university"
                  />
                )}
              />
              {errors.university && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.university.message}
                </p>
              )}
            </FormField>

            <FormField label="Country" required>
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <SelectWithOther
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    options={countries}
                    otherValue="other"
                    placeholder="Select country"
                    otherPlaceholder="Country name"
                  />
                )}
              />
              {errors.country && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.country.message}
                </p>
              )}
            </FormField>

            <FormField label="Degree" required>
              <Controller
                name="degree"
                control={control}
                render={({ field }) => (
                  <SelectWithOther
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    options={degreeOptions}
                    otherValue="other"
                    placeholder="Select degree"
                    otherPlaceholder="Degree name"
                  />
                )}
              />
              {errors.degree && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.degree.message}
                </p>
              )}
            </FormField>

            <FormField label="Graduation Year" required>
              <Controller
                name="graduationYear"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(val) => field.onChange(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {graduationYears.map((year: number) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.graduationYear && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.graduationYear.message}
                </p>
              )}
            </FormField>

            <FormField label="Previous Hackathons" required>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                {...register("previousHackathons", { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.previousHackathons && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.previousHackathons.message}
                </p>
              )}
            </FormField>

            <FormField label="Major" required>
              <Controller
                name="major"
                control={control}
                render={({ field }) => (
                  <SelectWithOther
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    options={majorOptions}
                    otherValue="other"
                    placeholder="Select major"
                    otherPlaceholder="Major name"
                  />
                )}
              />
              {errors.major && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.major.message}
                </p>
              )}
            </FormField>
          </div>

          <FormField label="Resume (PDF)" required>
            <Input
              type="file"
              accept=".pdf"
              disabled={uploadState === "uploading"}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_RESUME_SIZE) {
                  setUploadError(
                    "Your resume is larger than 10 MB. Please upload a smaller PDF.",
                  );
                  setUploadState("error");
                  e.target.value = "";
                  return;
                }
                setUploadError(null);
                setUploadState("uploading");
                try {
                  const body = new FormData();
                  body.append("file", file);
                  const result = await uploadResume(body);
                  if ("error" in result) {
                    throw new Error(result.error);
                  }
                  const { key } = result;
                  setValue("resume", key);
                  setJustUploaded(true);
                  setUploadState("done");
                  // Fetch a viewable URL so the preview renders immediately,
                  // without waiting for a page reload.
                  try {
                    setUploadedUrl(await getResumeDownloadUrl(key));
                  } catch (urlErr) {
                    console.error("Resume preview URL error:", urlErr);
                  }
                } catch (err) {
                  console.error("Resume upload error:", err);
                  setUploadError(
                    err instanceof Error && err.message
                      ? err.message
                      : "Upload failed — please try again",
                  );
                  setUploadState("error");
                }
              }}
            />
            {uploadState === "idle" && (
              <p className="font-red-hat text-xs text-muted-foreground">
                Upload your resume as a PDF (max 10 MB)
              </p>
            )}
            {uploadState === "uploading" && (
              <p className="font-red-hat text-xs text-muted-foreground animate-pulse">
                Uploading…
              </p>
            )}
            {uploadState === "done" && (
              <p className="font-red-hat text-xs text-green-600">
                {justUploaded
                  ? "Resume uploaded successfully"
                  : "Resume on file — upload a new PDF to replace it"}
              </p>
            )}
            {uploadState === "error" && (
              <p className="font-red-hat text-xs text-destructive">
                {uploadError ?? "Upload failed — please try again"}
              </p>
            )}
            {errors.resume && (
              <p className="font-red-hat text-[11px] text-destructive">
                {errors.resume.message}
              </p>
            )}
          </FormField>

          {previewUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p
                  className="font-red-hat text-sm font-medium"
                  style={{ color: "#3A4A26" }}
                >
                  Your Resume
                </p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto text-xs underline underline-offset-2"
                  style={{ color: "rgba(58,74,38,0.6)" }}
                >
                  Open in new tab
                </a>
              </div>
              <iframe
                src={previewUrl}
                title="Your resume"
                className="pointer-events-auto w-full rounded-xl border"
                style={{
                  height: "480px",
                  borderColor: "rgba(58,74,38,0.15)",
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default AcademicInformation;
