"use client";

import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Loader2Icon } from "lucide-react";
import {
  createReservationEvent,
  updateReservationEvent,
} from "@/lib/actions/admin-reservations.server.actions";
import type { AdminReservationEventDetail } from "@/lib/queries/admin-reservations";
import type { ReservationEventStatus } from "@/lib/reservation/domain";
import type { ReservationEventInput } from "@/lib/reservation/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EventFormValues = {
  name: string;
  description: string;
  location: string;
  startsAt: string;
  status: ReservationEventStatus;
  reservationsOpenAt: string;
  reservationsCloseAt: string;
};

type EventFormField = keyof EventFormValues;
type FieldErrors = Record<string, string[] | undefined>;
type ReservationEventFormProps = {
  event?: AdminReservationEventDetail;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onSuccess?: (message: string) => void;
};

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useClientHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
}

function toDateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 16);
}

function formValuesFor(
  event: AdminReservationEventDetail | undefined,
): EventFormValues {
  return {
    name: event?.name ?? "",
    description: event?.description ?? "",
    location: event?.location ?? "",
    startsAt: toDateTimeLocal(event?.startsAt),
    status: event?.status ?? "draft",
    reservationsOpenAt: toDateTimeLocal(event?.reservationsOpenAt),
    reservationsCloseAt: toDateTimeLocal(event?.reservationsCloseAt),
  };
}

function toAbsoluteDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function eventInputFrom(values: EventFormValues): ReservationEventInput {
  return {
    name: values.name,
    description: values.description,
    location: values.location,
    startsAt: toAbsoluteDate(values.startsAt),
    status: values.status === "archived" ? "closed" : values.status,
    reservationsOpenAt: toAbsoluteDate(values.reservationsOpenAt),
    reservationsCloseAt: toAbsoluteDate(values.reservationsCloseAt),
  };
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

export function ReservationEventForm(props: ReservationEventFormProps) {
  const hydrated = useClientHydrated();

  if (props.event && !hydrated) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Preparing local event times…
      </p>
    );
  }

  return <ReservationEventFormFields {...props} />;
}

function ReservationEventFormFields({
  event,
  disabled = false,
  onPendingChange,
  onSuccess,
}: ReservationEventFormProps) {
  const id = useId();
  const [values, setValues] = useState<EventFormValues>(() =>
    formValuesFor(event),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);
  const isEditing = Boolean(event);
  const controlsDisabled = disabled || isPending;

  function updateField(field: EventFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
  }

  function handleSubmit(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (disabled || submittingRef.current) return;

    setFormError(null);
    setFieldErrors({});
    submittingRef.current = true;
    onPendingChange?.(true);

    startTransition(async () => {
      try {
        const input = eventInputFrom(values);
        const result = event
          ? await updateReservationEvent({ eventId: event.id, values: input })
          : await createReservationEvent(input);

        if (!result.ok) {
          setFormError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }

        onSuccess?.(result.message);
      } catch {
        setFormError(
          isEditing
            ? "Could not update the event. Try again."
            : "Could not create the event. Try again.",
        );
      } finally {
        submittingRef.current = false;
        onPendingChange?.(false);
      }
    });
  }

  function errorId(field: EventFormField) {
    return `${id}-${field}-error`;
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <fieldset
        disabled={controlsDisabled}
        className="flex flex-col gap-4 disabled:opacity-70"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-name`}>Event name</Label>
          <Input
            id={`${id}-name`}
            name="name"
            value={values.name}
            required
            maxLength={200}
            aria-invalid={Boolean(fieldErrors.name?.length)}
            aria-describedby={
              fieldErrors.name?.length ? errorId("name") : undefined
            }
            onChange={(inputEvent) =>
              updateField("name", inputEvent.target.value)
            }
          />
          <FieldError id={errorId("name")} errors={fieldErrors.name} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-description`}>Description</Label>
          <Textarea
            id={`${id}-description`}
            name="description"
            value={values.description}
            maxLength={2_000}
            aria-invalid={Boolean(fieldErrors.description?.length)}
            aria-describedby={
              fieldErrors.description?.length
                ? errorId("description")
                : undefined
            }
            onChange={(inputEvent) =>
              updateField("description", inputEvent.target.value)
            }
          />
          <FieldError
            id={errorId("description")}
            errors={fieldErrors.description}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-location`}>Location</Label>
            <Input
              id={`${id}-location`}
              name="location"
              value={values.location}
              maxLength={200}
              aria-invalid={Boolean(fieldErrors.location?.length)}
              aria-describedby={
                fieldErrors.location?.length ? errorId("location") : undefined
              }
              onChange={(inputEvent) =>
                updateField("location", inputEvent.target.value)
              }
            />
            <FieldError
              id={errorId("location")}
              errors={fieldErrors.location}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-starts-at`}>Start time</Label>
            <Input
              id={`${id}-starts-at`}
              name="startsAt"
              type="datetime-local"
              value={values.startsAt}
              aria-invalid={Boolean(fieldErrors.startsAt?.length)}
              aria-describedby={
                fieldErrors.startsAt?.length ? errorId("startsAt") : undefined
              }
              onChange={(inputEvent) =>
                updateField("startsAt", inputEvent.target.value)
              }
            />
            <FieldError
              id={errorId("startsAt")}
              errors={fieldErrors.startsAt}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <Select
            value={values.status}
            disabled={controlsDisabled}
            onValueChange={(value) => updateField("status", value)}
          >
            <SelectTrigger
              id={`${id}-status`}
              aria-invalid={Boolean(fieldErrors.status?.length)}
              aria-describedby={
                fieldErrors.status?.length ? errorId("status") : undefined
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                {values.status === "archived" ? (
                  <SelectItem value="archived" disabled>
                    Archived
                  </SelectItem>
                ) : null}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError id={errorId("status")} errors={fieldErrors.status} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-reservations-open`}>Reservations open</Label>
            <Input
              id={`${id}-reservations-open`}
              name="reservationsOpenAt"
              type="datetime-local"
              value={values.reservationsOpenAt}
              aria-invalid={Boolean(fieldErrors.reservationsOpenAt?.length)}
              aria-describedby={
                fieldErrors.reservationsOpenAt?.length
                  ? errorId("reservationsOpenAt")
                  : undefined
              }
              onChange={(inputEvent) =>
                updateField("reservationsOpenAt", inputEvent.target.value)
              }
            />
            <FieldError
              id={errorId("reservationsOpenAt")}
              errors={fieldErrors.reservationsOpenAt}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-reservations-close`}>
              Reservations close
            </Label>
            <Input
              id={`${id}-reservations-close`}
              name="reservationsCloseAt"
              type="datetime-local"
              value={values.reservationsCloseAt}
              aria-invalid={Boolean(fieldErrors.reservationsCloseAt?.length)}
              aria-describedby={
                fieldErrors.reservationsCloseAt?.length
                  ? errorId("reservationsCloseAt")
                  : undefined
              }
              onChange={(inputEvent) =>
                updateField("reservationsCloseAt", inputEvent.target.value)
              }
            />
            <FieldError
              id={errorId("reservationsCloseAt")}
              errors={fieldErrors.reservationsCloseAt}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={controlsDisabled}>
          {isPending ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : null}
          {isEditing ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
