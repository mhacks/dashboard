import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <CardHeader>
        <CardTitle className="font-heading italic" style={{ color: "#3A4A26" }}>
          Socials
        </CardTitle>
        <CardDescription>Optional: Share your social links</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="GitHub (optional)">
          <Input
            {...register("github")}
            placeholder="https://github.com/username"
          />
          {errors.github && (
            <p className="text-sm text-destructive">{errors.github.message}</p>
          )}
        </FormField>

        <FormField label="LinkedIn (optional)">
          <Input
            {...register("linkedin")}
            placeholder="https://linkedin.com/in/username"
          />
          {errors.linkedin && (
            <p className="text-sm text-destructive">
              {errors.linkedin.message}
            </p>
          )}
        </FormField>

        <FormField label="Personal Site (optional)">
          <Input
            {...register("personalSite")}
            placeholder="https://yourwebsite.com"
          />
          {errors.personalSite && (
            <p className="text-sm text-destructive">
              {errors.personalSite.message}
            </p>
          )}
        </FormField>
      </CardContent>
    </Card>
  );
};

export default Socials;
