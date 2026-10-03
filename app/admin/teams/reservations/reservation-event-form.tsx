"use client";

import { useId, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import type { ReservationActionResult } from "@/lib/actions/admin-reservations.server.actions";
import {
  describeWindow,
  getWindowAvailability,
} from "@/lib/reservation/domain";
import type { WindowInput } from "@/lib/reservation/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldErrors = Record<string, string[] | undefined>;

function toDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 16);
}

function toAbsoluteDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function FieldError({
  id,
  errors,
}: {
  id: string;
  errors: string[] | undefined;
}) {
  if (!errors?.length) return null;

  return (
    <p id={id} className="text-xs text-destructive">
      {errors.join(" ")}
    </p>
  );
}

export function WindowForm({
  opensAt,
  closesAt,
  save,
  onSuccess,
}: {
  opensAt: string | null;
  closesAt: string | null;
  save: (input: WindowInput) => Promise<ReservationActionResult>;
  onSuccess?: (message: string) => void;
}) {
  const hydrated = useMounted();

  if (!hydrated) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Preparing local times…
      </p>
    );
  }

  return (
    <WindowFields
      opensAt={opensAt}
      closesAt={closesAt}
      save={save}
      onSuccess={onSuccess}
    />
  );
}

function WindowFields({
  opensAt,
  closesAt,
  save,
  onSuccess,
}: {
  opensAt: string | null;
  closesAt: string | null;
  save: (input: WindowInput) => Promise<ReservationActionResult>;
  onSuccess?: (message: string) => void;
}) {
  const id = useId();
  const [opensAtValue, setOpensAtValue] = useState(toDateTimeLocal(opensAt));
  const [closesAtValue, setClosesAtValue] = useState(toDateTimeLocal(closesAt));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const status = describeWindow(getWindowAvailability({ opensAt, closesAt }));

  function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const values: WindowInput = {
      opensAt: toAbsoluteDate(opensAtValue),
      closesAt: toAbsoluteDate(closesAtValue),
    };

    startTransition(async () => {
      try {
        const result = await save(values);
        if (!result.ok) {
          setFieldErrors(result.fieldErrors ?? {});
          setFormError(result.error);
          return;
        }
        onSuccess?.(result.message);
      } catch (error) {
        console.error("Unable to update window:", error);
        setFormError("Could not update this window. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{status}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-open`}>Opens</Label>
          <Input
            id={`${id}-open`}
            type="datetime-local"
            value={opensAtValue}
            onChange={(change) => setOpensAtValue(change.target.value)}
            aria-invalid={Boolean(fieldErrors.opensAt?.length)}
            aria-describedby={`${id}-open-error`}
          />
          <FieldError id={`${id}-open-error`} errors={fieldErrors.opensAt} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-close`}>Closes</Label>
          <Input
            id={`${id}-close`}
            type="datetime-local"
            value={closesAtValue}
            onChange={(change) => setClosesAtValue(change.target.value)}
            aria-invalid={Boolean(fieldErrors.closesAt?.length)}
            aria-describedby={`${id}-close-error`}
          />
          <FieldError id={`${id}-close-error`} errors={fieldErrors.closesAt} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave close empty to keep the window open. Hackers are locked out before
        the opening time and at the close time. The team page shows these
        deadlines in America/Detroit.
      </p>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : null}
          Save window
        </Button>
      </div>
    </form>
  );
}
