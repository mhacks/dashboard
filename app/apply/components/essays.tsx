import {
  UseFormRegister,
  FieldErrors,
  useWatch,
  Control,
} from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "../utils";
import { HackerApplicationFormData } from "@/lib/types/applications";

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function Counters({
  value,
  maxWords,
  maxChars,
}: {
  value: string;
  maxWords: number;
  maxChars: number;
}) {
  const words = value ? wordCount(value) : 0;
  const chars = value ? value.length : 0;
  const wordsOver = words > maxWords;
  const charsOver = chars > maxChars;
  const bad = wordsOver || charsOver;

  return (
    <span
      className="text-[11px] font-red-hat tabular-nums shrink-0"
      style={{ color: bad ? "#dc2626" : "rgba(58,74,38,0.4)" }}
    >
      {words}/{maxWords} words · {chars}/{maxChars} chars
    </span>
  );
}

const Essays = ({
  register,
  errors,
  control,
}: {
  register: UseFormRegister<HackerApplicationFormData>;
  errors: FieldErrors<HackerApplicationFormData>;
  control: Control<HackerApplicationFormData>;
}) => {
  const whatWouldYouDo = useWatch({ control, name: "whatWouldYouDo" }) ?? "";
  const whyMhacks = useWatch({ control, name: "whyMhacks" }) ?? "";
  const hillToDieOn = useWatch({ control, name: "hillToDieOn" }) ?? "";

  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
      <CardHeader>
        <CardTitle className="font-heading italic" style={{ color: "#3A4A26" }}>
          Essays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="What would you do?" required>
          <Textarea
            {...register("whatWouldYouDo")}
            placeholder="Tell us what you'd build or do at MHacks..."
            rows={4}
          />
          <div className="flex items-start justify-between gap-2">
            {errors.whatWouldYouDo ? (
              <p className="font-red-hat text-sm text-destructive">
                {errors.whatWouldYouDo.message}
              </p>
            ) : (
              <span />
            )}
            <Counters value={whatWouldYouDo} maxWords={100} maxChars={600} />
          </div>
        </FormField>

        <FormField label="Why MHacks?" required>
          <Textarea
            {...register("whyMhacks")}
            placeholder="Why do you want to come to MHacks specifically?"
            rows={4}
          />
          <div className="flex items-start justify-between gap-2">
            {errors.whyMhacks ? (
              <p className="font-red-hat text-sm text-destructive">
                {errors.whyMhacks.message}
              </p>
            ) : (
              <span />
            )}
            <Counters value={whyMhacks} maxWords={200} maxChars={1200} />
          </div>
        </FormField>

        <FormField label="What's a hill you're willing to die on?" required>
          <Textarea
            {...register("hillToDieOn")}
            placeholder="A strong take, in 10 words or fewer..."
            rows={2}
          />
          <div className="flex items-start justify-between gap-2">
            {errors.hillToDieOn ? (
              <p className="font-red-hat text-sm text-destructive">
                {errors.hillToDieOn.message}
              </p>
            ) : (
              <span />
            )}
            <Counters value={hillToDieOn} maxWords={10} maxChars={80} />
          </div>
        </FormField>
      </CardContent>
    </Card>
  );
};

export default Essays;
