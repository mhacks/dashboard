import {
  Controller,
  UseFormRegister,
  FieldErrors,
  Control,
  useWatch,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ethnicityOptions } from "../form-options";
import { FormField, formatPhoneNumber } from "../utils";
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
  readOnly = false,
}: {
  register: UseFormRegister<HackerApplicationFormData>;
  errors: FieldErrors<HackerApplicationFormData>;
  control: Control<HackerApplicationFormData>;
  readOnly?: boolean;
}) => {
  // Applicants who submitted before these fields existed have empty values.
  // When viewing a read-only application, hide any field that wasn't collected.
  const [firstName, lastName, phoneNumber] = useWatch({
    control,
    name: ["firstName", "lastName", "phoneNumber"],
  });
  const showField = (value: string | undefined) =>
    !readOnly || (value ?? "").trim() !== "";

  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
      <CardContent className="space-y-4 font-red-hat">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showField(firstName) && (
            <FormField label="First Name" required>
              <Input
                className="font-red-hat placeholder:font-red-hat"
                type="text"
                autoComplete="given-name"
                {...register("firstName")}
                placeholder="Jane"
              />
              {errors.firstName && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </FormField>
          )}

          {showField(lastName) && (
            <FormField label="Last Name" required>
              <Input
                className="font-red-hat placeholder:font-red-hat"
                type="text"
                autoComplete="family-name"
                {...register("lastName")}
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </FormField>
          )}

          {showField(phoneNumber) && (
            <FormField label="Phone Number" required className="md:col-span-2">
              <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    className="font-red-hat placeholder:font-red-hat"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(formatPhoneNumber(e.target.value))
                    }
                    onBlur={field.onBlur}
                    placeholder="+12345678901"
                  />
                )}
              />
              {errors.phoneNumber && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.phoneNumber.message}
                </p>
              )}
            </FormField>
          )}

          <FormField label="Age" required>
            <Input
              className="font-red-hat placeholder:font-red-hat"
              type="number"
              min={18}
              max={120}
              step={1}
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
