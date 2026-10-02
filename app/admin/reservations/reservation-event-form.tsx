"use client";

import { useId, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { setReservationWindow } from "@/lib/actions/admin-reservations.server.actions";
import type { AdminReservationDetail } from "@/lib/queries/admin-reservations";
import type { ReservationEventInput } from "@/lib/reservation/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldErrors = Record<string, string[] | undefined>;

function toDateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
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

export function ReservationEventForm({
  event,
  onSuccess,
}: {
  event: AdminReservationDetail;
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

  return <ReservationWindowFields event={event} onSuccess={onSuccess} />;
}

function ReservationWindowFields({
  event,
  onSuccess,
}: {
  event: AdminReservationDetail;
  onSuccess?: (message: string) => void;
}) {
  const id = useId();
  const [opensAt, setOpensAt] = useState(
    toDateTimeLocal(event.reservationsOpenAt),
  );
  const [closesAt, setClosesAt] = useState(
    toDateTimeLocal(event.reservationsCloseAt),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const values: ReservationEventInput = {
      reservationsOpenAt: toAbsoluteDate(opensAt),
      reservationsCloseAt: toAbsoluteDate(closesAt),
    };

    startTransition(async () => {
      try {
        const result = await setReservationWindow(values);
        if (!result.ok) {
          setFieldErrors(result.fieldErrors ?? {});
          setFormError(result.error);
          return;
        }
        onSuccess?.(result.message);
      } catch {
        setFormError("Could not update the reservation. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-open`}>Opens</Label>
          <Input
            id={`${id}-open`}
            type="datetime-local"
            value={opensAt}
            onChange={(change) => setOpensAt(change.target.value)}
            aria-invalid={Boolean(fieldErrors.reservationsOpenAt?.length)}
          />
          <FieldError
            id={`${id}-open-error`}
            errors={fieldErrors.reservationsOpenAt}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-close`}>Closes</Label>
          <Input
            id={`${id}-close`}
            type="datetime-local"
            value={closesAt}
            onChange={(change) => setClosesAt(change.target.value)}
            aria-invalid={Boolean(fieldErrors.reservationsCloseAt?.length)}
          />
          <FieldError
            id={`${id}-close-error`}
            errors={fieldErrors.reservationsCloseAt}
          />
        </div>
      </div>
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
