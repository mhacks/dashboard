import {
  Controller,
  UseFormRegister,
  FieldErrors,
  Control,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ethnicityOptions } from "../form-options";
import { FormField } from "../utils";
import { SelectWithOther } from "./select-with-other";
import { HackerApplicationFormData } from "@/lib/types/applications";

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other (please describe)" },
];

const PersonalInformation = ({
  register,
  errors,
  control,
}: {
  register: UseFormRegister<HackerApplicationFormData>;
  errors: FieldErrors<HackerApplicationFormData>;
  control: Control<HackerApplicationFormData>;
}) => {
  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
      <CardHeader>
        <CardTitle className="font-heading italic" style={{ color: "#3A4A26" }}>
          Personal Information
        </CardTitle>
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
              <p className="font-red-hat text-[11px] text-destructive">
                {errors.age.message}
              </p>
            )}
          </FormField>

          <FormField label="Gender" required>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <SelectWithOther
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  options={genderOptions}
                  otherValue="other"
                  placeholder="Select gender"
                  otherPlaceholder="Describe your gender"
                />
              )}
            />
            {errors.gender && (
              <p className="font-red-hat text-[11px] text-destructive">
                {errors.gender.message}
              </p>
            )}
          </FormField>

          <FormField label="Ethnicity" required className="md:col-span-2">
            <Controller
              name="ethnicity"
              control={control}
              render={({ field }) => (
                <SelectWithOther
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  options={ethnicityOptions}
                  otherValue="multiracial"
                  placeholder="Select ethnicity"
                  otherPlaceholder="Describe your ethnicity"
                />
              )}
            />
            {errors.ethnicity && (
              <p className="font-red-hat text-[11px] text-destructive">
                {errors.ethnicity.message}
              </p>
            )}
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalInformation;
