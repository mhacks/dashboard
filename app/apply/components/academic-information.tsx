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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  countries,
  degreeOptions,
  majorOptions,
  universities,
} from "../form-options";
import { FormField } from "../utils";
import { HackerApplicationFormData } from "@/lib/types/applications";
import { getResumeDownloadUrl } from "@/lib/aws/s3";

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 10 }, (_, i) => currentYear + i);

const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10 MB — mirrors the upload API limit

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
  const university = useWatch({ control, name: "university" });
  const country = useWatch({ control, name: "country" });
  const degree = useWatch({ control, name: "degree" });
  const major = useWatch({ control, name: "major" });
  return (
    <>
      {" "}
      {/* Academic Information */}
      <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
        <CardHeader>
          <CardTitle
            className="font-heading italic"
            style={{ color: "#3A4A26" }}
          >
            Academic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="University" required>
              <Controller
                name="university"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select university" />
                    </SelectTrigger>
                    <SelectContent>
                      {universities.map((uni) => (
                        <SelectItem key={uni.value} value={uni.value}>
                          {uni.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.university && (
                <p className="font-red-hat text-sm text-destructive">
                  {errors.university.message}
                </p>
              )}
            </FormField>

            {university === "other" && (
              <FormField label="Please specify your university">
                <Input
                  {...register("universityOther")}
                  placeholder="University name"
                />
              </FormField>
            )}

            <FormField label="Country" required>
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.country && (
                <p className="font-red-hat text-sm text-destructive">
                  {errors.country.message}
                </p>
              )}
            </FormField>

            {country === "other" && (
              <FormField label="Please specify your country">
                <Input
                  {...register("countryOther")}
                  placeholder="Country name"
                />
              </FormField>
            )}

            <FormField label="Degree" required>
              <Controller
                name="degree"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select degree" />
                    </SelectTrigger>
                    <SelectContent>
                      {degreeOptions.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.degree && (
                <p className="font-red-hat text-sm text-destructive">
                  {errors.degree.message}
                </p>
              )}
            </FormField>

            {degree === "other" && (
              <FormField label="Please specify your degree">
                <Input {...register("degreeOther")} placeholder="Degree name" />
              </FormField>
            )}

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
                <p className="font-red-hat text-sm text-destructive">
                  {errors.graduationYear.message}
                </p>
              )}
            </FormField>

            <FormField label="Previous Hackathons" required>
              <Input
                type="number"
                min={0}
                {...register("previousHackathons", { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.previousHackathons && (
                <p className="font-red-hat text-sm text-destructive">
                  {errors.previousHackathons.message}
                </p>
              )}
            </FormField>

            <FormField label="Major" required>
              <Controller
                name="major"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select major" />
                    </SelectTrigger>
                    <SelectContent>
                      {majorOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.major && (
                <p className="font-red-hat text-sm text-destructive">
                  {errors.major.message}
                </p>
              )}
            </FormField>

            {major === "other" && (
              <FormField label="Please specify your major">
                <Input {...register("majorOther")} placeholder="Major name" />
              </FormField>
            )}
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
                  const res = await fetch("/api/upload-resume", {
                    method: "POST",
                    body,
                  });
                  if (!res.ok) {
                    throw new Error(await res.text());
                  }
                  const { key } = await res.json();
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
              <p className="font-red-hat text-sm text-destructive">
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
