import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "../utils";
import { HackerApplicationFormData } from "@/lib/types/applications";

const Socials = ({
  register,
  errors,
}: {
  register: UseFormRegister<HackerApplicationFormData>;
  errors: FieldErrors<HackerApplicationFormData>;
}) => {
  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
      <CardContent className="space-y-4">
        <FormField label="GitHub">
          <Input
            {...register("github")}
            placeholder="https://github.com/username"
          />
          {errors.github && (
            <p className="font-red-hat text-[11px] text-destructive">
              {errors.github.message}
            </p>
          )}
        </FormField>

        <FormField label="LinkedIn">
          <Input
            {...register("linkedin")}
            placeholder="https://linkedin.com/in/username"
          />
          {errors.linkedin && (
            <p className="font-red-hat text-[11px] text-destructive">
              {errors.linkedin.message}
            </p>
          )}
        </FormField>

        <FormField label="Personal Site">
          <Input
            {...register("personalSite")}
            placeholder="https://yourwebsite.com"
          />
          {errors.personalSite && (
            <p className="font-red-hat text-[11px] text-destructive">
              {errors.personalSite.message}
            </p>
          )}
        </FormField>
      </CardContent>
    </Card>
  );
};

export default Socials;
