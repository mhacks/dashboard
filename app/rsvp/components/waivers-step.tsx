"use client";

import { useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

import { BooleanChoice, FormQuestion } from "@/components/forms/form-question";
import { FormSectionCard } from "@/components/forms/form-section-card";
import { Textarea } from "@/components/ui/textarea";
import type { RsvpFormData } from "@/lib/types/rsvps";

const ACTIVITIES_WAIVER_URL =
  "https://drive.google.com/file/d/1K6OsDr_UCc3lrtSCYjtXt2MIpCwyfWZy/view?usp=sharing";

export function WaiversStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<RsvpFormData>();
  const activitiesWaiverResponse = useWatch({
    control,
    name: "activitiesWaiverResponse",
  });
  const [activitiesWaiverOpened, setActivitiesWaiverOpened] = useState(false);
  const activitiesWaiverUnlocked =
    activitiesWaiverOpened || activitiesWaiverResponse !== undefined;
  const handleOpenActivitiesWaiver = () => setActivitiesWaiverOpened(true);

  return (
    <div className="flex flex-col gap-5">
      <FormSectionCard contentClassName="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="font-red-hat text-sm leading-6 text-foreground">
            I confirm that I have read and understood the{" "}
            <a
              href={ACTIVITIES_WAIVER_URL}
              target="_blank"
              rel="noreferrer"
              onClick={handleOpenActivitiesWaiver}
              className="font-medium text-moss underline underline-offset-4"
            >
              Activities Waiver
            </a>{" "}
            document. The above agreements are binding upon me, my estate,
            heirs, representatives, and assigns. I understand that selecting
            &quot;No&quot; will not allow me to participate in some activities
            at MHacks 2026.
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </p>
          <Controller
            name="activitiesWaiverResponse"
            control={control}
            render={({ field }) => (
              <BooleanChoice
                id="activities-waiver"
                value={field.value}
                onChange={field.onChange}
                error={errors.activitiesWaiverResponse}
                disabled={!activitiesWaiverUnlocked}
                disabledMessage={
                  activitiesWaiverUnlocked
                    ? undefined
                    : "Open the Activities Waiver before answering."
                }
              />
            )}
          />
        </div>
      </FormSectionCard>

      <FormSectionCard contentClassName="flex flex-col gap-4">
        <div className="flex flex-col gap-3 font-red-hat text-sm leading-6 text-foreground">
          <p>
            I hereby grant the MHacks permission to use my likeness in a
            photograph, video, or other digital media (&quot;photo&quot;) in any
            and all of its publications, including web-based publications,
            without payment or other consideration.
          </p>
          <p>
            I understand and agree that all photos will become the property of
            the MHacks and will not be returned.
          </p>
          <p>
            I hereby irrevocably authorize the MHacks to edit, alter, copy,
            exhibit, publish, or distribute these photos for any lawful purpose.
            In addition, I waive any right to inspect or approve the finished
            product wherein my likeness appears. Additionally, I waive any right
            to royalties or other compensation arising or related to the use of
            the photo.
          </p>
          <p>
            I hereby hold harmless, release, and forever discharge the MHacks
            from all claims, demands, and causes of action which I, my heirs,
            representatives, executors, administrators, or any other persons
            acting on my behalf or on behalf of my estate have or may have by
            reason of this authorization.
          </p>
          <p className="font-semibold">
            I HAVE READ AND UNDERSTAND THE ABOVE PHOTO RELEASE.
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </p>
        </div>
        <Controller
          name="photoReleaseResponse"
          control={control}
          render={({ field }) => (
            <BooleanChoice
              id="photo-release"
              value={field.value}
              onChange={field.onChange}
              error={errors.photoReleaseResponse}
            />
          )}
        />
      </FormSectionCard>

      <FormSectionCard contentClassName="flex flex-col gap-3">
        <p className="font-red-hat text-[10px] font-semibold tracking-[0.3em] text-moss/45 uppercase">
          LAST ONE!
        </p>
        <FormQuestion
          label="Anything else you'd like the MHacks Team to know?"
          htmlFor="additionalNotes"
          error={errors.additionalNotes}
        >
          <Textarea
            id="additionalNotes"
            rows={5}
            aria-invalid={Boolean(errors.additionalNotes)}
            {...register("additionalNotes")}
          />
        </FormQuestion>
      </FormSectionCard>
    </div>
  );
}
