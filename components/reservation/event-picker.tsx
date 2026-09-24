"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ParticipantEvent } from "@/lib/reservation/types";

export function EventPicker({
  events,
  selectedEventId,
  disabled = false,
  onEventChange,
}: {
  events: ParticipantEvent[];
  selectedEventId: string;
  disabled?: boolean;
  onEventChange?: (eventId: string) => void;
}) {
  const router = useRouter();

  function handleValueChange(id: string) {
    if (onEventChange) {
      onEventChange(id);
      return;
    }
    router.push(`/reserve?event=${id}`);
  }

  return (
    <Select
      value={selectedEventId}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select an event" />
      </SelectTrigger>
      <SelectContent>
        {events.map((event) => (
          <SelectItem key={event.id} value={event.id}>
            {event.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
