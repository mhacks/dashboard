import { Controller, useWatch } from "react-hook-form";
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
} from "../form-options";
import { FormField } from "../utils";

const PersonalInformation = ({
  register,
  errors,
  control,
  genderOptions,
  gender,
  ethnicity,
}: any) => {
  return (
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
              <p className="text-sm text-destructive">{errors.age.message}</p>
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
                    {genderOptions.map((option: any) => (
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
  );
};

export default PersonalInformation;
