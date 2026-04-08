import { Controller, useWatch } from "react-hook-form";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { shirtSizeOptions, transportationOptions } from "../form-options";
import { FormField } from "../utils";

const Logistics = ({
  register,
  errors,
  control,
  hasAllergies,
  needsTravelReimbursement,
}: any) => {
  return (
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
  );
};

export default Logistics;
