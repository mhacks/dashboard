import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  countries,
  degreeOptions,
  majorOptions,
  universities,
} from "../form-options";
import { FormField } from "../utils";
import { getResumeUploadUrl } from "@/lib/aws/s3";

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 10 }, (_, i) => currentYear + i);

type UploadState = "idle" | "uploading" | "done" | "error";

const AcademicInformation = ({ errors, register, control, setValue, userId }: any) => {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
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
          <CardTitle className="font-heading italic" style={{ color: "#3A4A26" }}>Academic Information</CardTitle>
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
                <p className="text-sm text-destructive">
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
                <p className="text-sm text-destructive">
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
                <p className="text-sm text-destructive">
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
                <p className="text-sm text-destructive">
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
                <p className="text-sm text-destructive">
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
                <p className="text-sm text-destructive">
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

          <FormField label="Resume (PDF)">
            <Input
              type="file"
              accept=".pdf"
              disabled={uploadState === "uploading"}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadState("uploading");
                try {
                  const { uploadUrl, objectUrl } = await getResumeUploadUrl(userId, file.name);
                  const res = await fetch(uploadUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": "application/pdf" },
                  });
                  if (!res.ok) {
                    throw new Error(`S3 returned ${res.status}: ${await res.text()}`);
                  }
                  setValue("resume", objectUrl);
                  setUploadState("done");
                } catch (err) {
                  console.error("Resume upload error:", err);
                  setUploadState("error");
                }
              }}
            />
            {uploadState === "idle" && (
              <p className="text-xs text-muted-foreground">Upload your resume as a PDF (max 10 MB)</p>
            )}
            {uploadState === "uploading" && (
              <p className="text-xs text-muted-foreground animate-pulse">Uploading…</p>
            )}
            {uploadState === "done" && (
              <p className="text-xs text-green-600">Resume uploaded successfully</p>
            )}
            {uploadState === "error" && (
              <p className="text-xs text-destructive">Upload failed — please try again</p>
            )}
          </FormField>
        </CardContent>
      </Card>
    </>
  );
};

export default AcademicInformation;
