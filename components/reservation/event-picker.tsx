"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Event } from "@/lib/db/queries/reservation";

export function EventPicker({
  events,
  selectedEventId,
}: {
  events: Event[];
  selectedEventId: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={selectedEventId}
      onValueChange={(id) => router.push(`/reserve?event=${id}`)}
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
