"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import { FormQuestion } from "@/components/forms/form-question";
import { FormSectionCard } from "@/components/forms/form-section-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CANADA_PROVINCE_OPTIONS,
  COUNTRY_OPTIONS,
  US_STATE_OPTIONS,
  formatPostalCodeInput,
} from "@/lib/geo/address";
import type { RsvpFormData } from "@/lib/types/rsvps";
import { DIETARY_OPTIONS, TSHIRT_OPTIONS } from "../form-options";

export function PersonalStep() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<RsvpFormData>();
  const country = useWatch({ control, name: "country" });
  const stateOptions =
    country === "United States"
      ? US_STATE_OPTIONS
      : country === "Canada"
        ? CANADA_PROVINCE_OPTIONS
        : null;

  return (
    <FormSectionCard>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormQuestion
          label="Full legal name"
          htmlFor="legalName"
          required
          helpText="We'll verify your identity at check-in. Bring a student ID, driver's license/state ID, passport, or another photo ID that matches this name."
          error={errors.legalName}
        >
          <Input
            id="legalName"
            autoComplete="name"
            aria-invalid={Boolean(errors.legalName)}
            {...register("legalName")}
          />
        </FormQuestion>

        <FormQuestion
          label="Preferred name"
          htmlFor="preferredName"
          required
          error={errors.preferredName}
        >
          <Input
            id="preferredName"
            autoComplete="nickname"
            aria-invalid={Boolean(errors.preferredName)}
            {...register("preferredName")}
          />
        </FormQuestion>

        <FormQuestion
          label="Email address"
          htmlFor="email"
          required
          error={errors.email}
          className="md:col-span-2"
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            readOnly
            aria-readonly="true"
            aria-invalid={Boolean(errors.email)}
            className="cursor-not-allowed bg-moss/5 text-moss/55"
            {...register("email")}
          />
        </FormQuestion>

        <div className="pt-3 md:col-span-2">
          <p className="font-red-hat text-sm leading-none font-medium text-moss">
            Address
          </p>
        </div>

        <FormQuestion
          label="Street Address"
          htmlFor="streetAddress"
          required
          error={errors.streetAddress}
          className="md:col-span-2"
        >
          <Input
            id="streetAddress"
            autoComplete="street-address"
            aria-invalid={Boolean(errors.streetAddress)}
            {...register("streetAddress")}
          />
        </FormQuestion>

        <FormQuestion
          label="Country"
          htmlFor="country"
          required
          error={errors.country}
        >
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(next) => {
                  field.onChange(next);
                  setValue("stateOrProvince", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setValue("postalCode", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              >
                <SelectTrigger
                  id="country"
                  aria-invalid={Boolean(errors.country)}
                >
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {COUNTRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </FormQuestion>

        <FormQuestion label="City" htmlFor="city" required error={errors.city}>
          <Input
            id="city"
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.city)}
            {...register("city")}
          />
        </FormQuestion>

        {stateOptions && (
          <FormQuestion
            label={country === "United States" ? "State" : "Province"}
            htmlFor="stateOrProvince"
            required
            error={errors.stateOrProvince}
          >
            <Controller
              name="stateOrProvince"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id="stateOrProvince"
                    aria-invalid={Boolean(errors.stateOrProvince)}
                  >
                    <SelectValue
                      placeholder={
                        country === "United States"
                          ? "Select state"
                          : "Select province"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {stateOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </FormQuestion>
        )}

        {stateOptions && (
          <FormQuestion
            label={country === "United States" ? "ZIP Code" : "Postal Code"}
            htmlFor="postalCode"
            required
            error={errors.postalCode}
          >
            <Controller
              name="postalCode"
              control={control}
              render={({ field }) => (
                <Input
                  id="postalCode"
                  autoComplete="postal-code"
                  inputMode={country === "United States" ? "numeric" : "text"}
                  aria-invalid={Boolean(errors.postalCode)}
                  value={field.value ?? ""}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(
                      formatPostalCodeInput(country, event.target.value),
                    )
                  }
                />
              )}
            />
          </FormQuestion>
        )}

        <div className="pt-3 md:col-span-2">
          <p className="font-red-hat text-sm leading-none font-medium text-moss">
            Preferences
          </p>
        </div>

        <FormQuestion
          label="Dietary Restrictions"
          required
          error={errors.dietaryRestrictions}
          className="md:col-span-2"
        >
          <Controller
            name="dietaryRestrictions"
            control={control}
            render={({ field }) => {
              const selectedValue = field.value?.includes("other")
                ? "other"
                : (field.value?.[0] ?? "");

              return (
                <Select
                  value={selectedValue}
                  onValueChange={(next) => {
                    field.onChange([next]);
                    if (next !== "other") {
                      setValue("otherDietaryRestriction", undefined, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    aria-invalid={Boolean(errors.dietaryRestrictions)}
                  >
                    <SelectValue placeholder="Select if applicable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DIETARY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              );
            }}
          />
        </FormQuestion>

        <Controller
          name="dietaryRestrictions"
          control={control}
          render={({ field }) =>
            field.value?.includes("other") ? (
              <FormQuestion
                label="Other dietary restriction"
                htmlFor="otherDietaryRestriction"
                required
                error={errors.otherDietaryRestriction}
                className="md:col-span-2"
              >
                <Input
                  id="otherDietaryRestriction"
                  aria-invalid={Boolean(errors.otherDietaryRestriction)}
                  {...register("otherDietaryRestriction")}
                />
              </FormQuestion>
            ) : (
              <></>
            )
          }
        />

        <FormQuestion
          label="T-shirt size"
          required
          error={errors.tshirtSize}
          className="md:col-span-2"
        >
          <Controller
            name="tshirtSize"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={Boolean(errors.tshirtSize)}>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TSHIRT_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </FormQuestion>
      </div>
    </FormSectionCard>
  );
}
