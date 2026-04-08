import { Controller, useWatch } from "react-hook-form";

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
} from "../form-options";
import { FormField } from "../utils";

const AcademicInformation = ({
  university,
  country,
  degree,
  major,
  errors,
  register,
  graduationYears,
  control,
  setValue,
}: any) => {
  return (
    <>
      {" "}
      {/* Academic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Academic Information</CardTitle>
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setValue("resume", file.name);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Upload your resume as a PDF (dummy upload for now)
            </p>
          </FormField>
        </CardContent>
      </Card>
    </>
  );
};

export default AcademicInformation;
