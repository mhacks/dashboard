import {
  Controller,
  useWatch,
  UseFormRegister,
  FieldErrors,
  Control,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  dietaryOptions,
  shirtSizeOptions,
  transportationOptions,
} from "../form-options";
import { FormField } from "../utils";
import { SelectWithOther } from "./select-with-other";
import { HackerApplicationFormData } from "@/lib/types/applications";

const Logistics = ({
  register,
  errors,
  control,
}: {
  register: UseFormRegister<HackerApplicationFormData>;
  errors: FieldErrors<HackerApplicationFormData>;
  control: Control<HackerApplicationFormData>;
}) => {
  const needsTravelReimbursement = useWatch({
    control,
    name: "needsTravelReimbursement",
  });
  const transportationType = useWatch({ control, name: "transportationType" });
  const isFlying = transportationType === "flying";
  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
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
              <p className="font-red-hat text-[11px] text-destructive">
                {errors.transportationType.message}
              </p>
            )}
          </FormField>

          <FormField label="Where Are You Coming From?" required>
            <Input {...register("comingFrom")} placeholder="City, State" />
            {errors.comingFrom && (
              <p className="font-red-hat text-[11px] text-destructive">
                {errors.comingFrom.message}
              </p>
            )}
          </FormField>

          {isFlying && (
            <FormField label="Departure Airport Code" required>
              <Input
                {...register("airportCode", {
                  setValueAs: (v: string) => v.toUpperCase(),
                })}
                placeholder="e.g. DTW"
                maxLength={3}
                className="uppercase"
              />
              {errors.airportCode && (
                <p className="font-red-hat text-[11px] text-destructive">
                  {errors.airportCode.message}
                </p>
              )}
            </FormField>
          )}

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
              <p className="font-red-hat text-[11px] text-destructive">
                {errors.shirtSize.message}
              </p>
            )}
          </FormField>
        </div>

        <FormField label="Dietary Restrictions or Allergies">
          <Controller
            name="allergiesDescription"
            control={control}
            render={({ field }) => (
              <SelectWithOther
                value={field.value ?? ""}
                onChange={field.onChange}
                options={dietaryOptions}
                otherValue="other"
                placeholder="Select if applicable"
                otherPlaceholder="Describe your dietary restriction or allergy"
              />
            )}
          />
          {errors.allergiesDescription && (
            <p className="font-red-hat text-[11px] text-destructive">
              {errors.allergiesDescription.message}
            </p>
          )}
        </FormField>

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
  );
};

export default Logistics;
