import { Controller, Control } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HackerApplicationFormData } from "@/lib/types/applications";

const SocialLink = ({ href, children }: { href: string; children: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="underline underline-offset-2 hover:opacity-80"
  >
    {children}
  </a>
);

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
            <span>
              Did you follow us on Instagram (
              <SocialLink href="https://www.instagram.com/mhacks_/">
                @mhacks_
              </SocialLink>
              ), X (<SocialLink href="https://x.com/mhacks">@mhacks</SocialLink>
              ), and LinkedIn (
              <SocialLink href="https://www.linkedin.com/company/3021482/">
                MHacks
              </SocialLink>
              )?
            </span>
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default Communications;
