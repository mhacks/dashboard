import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "../utils";

const Essays = ({ register, errors }: any) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Essays</CardTitle>
        <CardDescription>
          Please write 100-1000 characters for each response
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Why do you want to attend MHacks?" required>
          <Textarea
            {...register("whyAttend")}
            placeholder="Tell us why you want to attend MHacks..."
            rows={4}
          />
          {errors.whyAttend && (
            <p className="text-sm text-destructive">
              {errors.whyAttend.message}
            </p>
          )}
        </FormField>

        <FormField
          label="Describe a technical challenge you've faced and how you solved it."
          required
        >
          <Textarea
            {...register("technicalChallenge")}
            placeholder="Describe a technical challenge..."
            rows={4}
          />
          {errors.technicalChallenge && (
            <p className="text-sm text-destructive">
              {errors.technicalChallenge.message}
            </p>
          )}
        </FormField>

        <FormField label="Tell us about a project you're proud of." required>
          <Textarea
            {...register("proudProject")}
            placeholder="Tell us about a project you're proud of..."
            rows={4}
          />
          {errors.proudProject && (
            <p className="text-sm text-destructive">
              {errors.proudProject.message}
            </p>
          )}
        </FormField>

        <FormField label="Anything else you'd like us to know? (optional)">
          <Textarea
            {...register("anythingElse")}
            placeholder="Anything else..."
            rows={3}
          />
          {errors.anythingElse && (
            <p className="text-sm text-destructive">
              {errors.anythingElse.message}
            </p>
          )}
        </FormField>
      </CardContent>
    </Card>
  );
};

export default Essays;
