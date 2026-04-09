import { Controller, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ethnicityOptions } from "../form-options";
import { FormField } from "../utils";

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other (please describe)" },
];

const PersonalInformation = ({ register, errors, control }: any) => {
  const gender = useWatch({ control, name: "gender" });
  const ethnicity = useWatch({ control, name: "ethnicity" });
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
