"use client";

import { Controller, Control, FieldErrors } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { HackerApplicationFormData } from "@/lib/types/applications";

// stopPropagation so clicking a policy link doesn't toggle the checkbox the
// surrounding <Label> is bound to.
const PolicyLink = ({ href, children }: { href: string; children: string }) => (
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

const Agreements = ({
  control,
  errors,
}: {
  control: Control<HackerApplicationFormData>;
  errors: FieldErrors<HackerApplicationFormData>;
}) => {
  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-start gap-3">
            <Controller
              name="mlhCodeOfConduct"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="mlhCodeOfConduct"
                  className="mt-0.5"
                />
              )}
            />
            <Label
              htmlFor="mlhCodeOfConduct"
              className="text-sm leading-normal cursor-pointer"
            >
              <span>
                I have read and agree to the{" "}
                <PolicyLink href="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md">
                  MLH Code of Conduct
                </PolicyLink>
                .<span className="text-destructive"> *</span>
              </span>
            </Label>
          </div>
          {errors.mlhCodeOfConduct && (
            <p className="font-red-hat text-[11px] text-destructive pl-6">
              {errors.mlhCodeOfConduct.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-3">
            <Controller
              name="mlhPrivacyPolicy"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="mlhPrivacyPolicy"
                  className="mt-0.5"
                />
              )}
            />
            <Label
              htmlFor="mlhPrivacyPolicy"
              className="text-sm leading-normal cursor-pointer"
            >
              <span>
                I authorize you to share my application/registration information
                with Major League Hacking for event administration, ranking, and
                MLH/DEV administration (including the creation of linked
                accounts on MLH and DEV (dev.to)) in line with the{" "}
                <PolicyLink href="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md">
                  MLH Privacy Policy
                </PolicyLink>
                . I further agree to the terms of both the{" "}
                <PolicyLink href="https://github.com/MLH/mlh-policies/blob/main/contest-terms.md">
                  MLH Contest Terms and Conditions
                </PolicyLink>{" "}
                and the{" "}
                <PolicyLink href="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md">
                  MLH Privacy Policy
                </PolicyLink>
                .<span className="text-destructive"> *</span>
              </span>
            </Label>
          </div>
          {errors.mlhPrivacyPolicy && (
            <p className="font-red-hat text-[11px] text-destructive pl-6">
              {errors.mlhPrivacyPolicy.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-3">
            <Controller
              name="mlhEmails"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="mlhEmails"
                  className="mt-0.5"
                />
              )}
            />
            <Label
              htmlFor="mlhEmails"
              className="text-sm leading-normal cursor-pointer"
            >
              <span>
                I authorize MLH to send me occasional emails about relevant
                events, career opportunities, and community announcements
                <span className="text-destructive"> *</span>
              </span>
            </Label>
          </div>
          {errors.mlhEmails && (
            <p className="font-red-hat text-[11px] text-destructive pl-6">
              {errors.mlhEmails.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-3">
            <Controller
              name="notAiSlop"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="notAiSlop"
                  className="mt-0.5"
                />
              )}
            />
            <Label
              htmlFor="notAiSlop"
              className="text-sm leading-normal cursor-pointer"
            >
              <span>
                I confirm that my application is not AI slop. I understand that
                if AI-generated content causes any fields to be filled out
                incorrectly, my application may be rejected.
                <span className="text-destructive"> *</span>
              </span>
            </Label>
          </div>
          {errors.notAiSlop && (
            <p className="font-red-hat text-[11px] text-destructive pl-6">
              {errors.notAiSlop.message}
            </p>
          )}
        </div>

        <div className="flex items-start gap-3">
          <Controller
            name="sponsorEmails"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                id="sponsorEmails"
                className="mt-0.5"
              />
            )}
          />
          <Label
            htmlFor="sponsorEmails"
            className="text-sm leading-normal cursor-pointer"
          >
            I agree to receive emails from event sponsors about relevant
            opportunities and updates
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default Agreements;
