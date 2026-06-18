import { Controller, Control } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HackerApplicationFormData } from "@/lib/types/applications";

const Communications = ({
  control,
}: {
  control: Control<HackerApplicationFormData>;
}) => {
  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
      <CardHeader>
        <CardTitle className="font-heading italic" style={{ color: "#3A4A26" }}>
          Communications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Controller
            name="followsInstagram"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                id="followsInstagram"
              />
            )}
          />
          <Label htmlFor="followsInstagram">
            Did you follow us on Instagram (@mhacks_)? (optional)
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default Communications;
