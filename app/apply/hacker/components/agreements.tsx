"use client";

import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Agreements = ({ control, errors }: any) => {
  return (
    <Card style={{ borderColor: "rgba(58,74,38,0.15)" }}>
      <CardHeader>
        <CardTitle className="font-heading italic" style={{ color: "#3A4A26" }}>MLH & Sponsor Agreements</CardTitle>
      </CardHeader>
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
              I have read and agree to the MLH Code of Conduct
              <span className="text-destructive"> *</span>
            </Label>
          </div>
          {errors.mlhCodeOfConduct && (
            <p className="text-sm text-destructive pl-6">
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
              I authorize you to share my application/registration information
              with Major League Hacking for event administration, ranking, and
              MLH administration in-line with the MLH Privacy Policy. I further
              agree to the terms of both the MLH Contest Terms and Conditions
              and the MLH Privacy Policy
              <span className="text-destructive"> *</span>
            </Label>
          </div>
          {errors.mlhPrivacyPolicy && (
            <p className="text-sm text-destructive pl-6">
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
              I authorize MLH to send me occasional emails about relevant
              events, career opportunities, and community announcements
              <span className="text-destructive"> *</span>
            </Label>
          </div>
          {errors.mlhEmails && (
            <p className="text-sm text-destructive pl-6">
              {errors.mlhEmails.message}
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
            opportunities and updates (optional)
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default Agreements;
