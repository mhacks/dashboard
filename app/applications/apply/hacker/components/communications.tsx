import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const Communications = ({ control, errors }: any) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Communications</CardTitle>
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
