"use server";

import { requireEventStaff } from "@/lib/auth/guards";
import {
  checkInAttendee,
  searchAttendees,
  type AttendeeMatch,
  type CheckInResult,
} from "@/lib/actions/check-in.actions";

export type {
  AttendeeMatch,
  CheckInResult,
  ScannedAttendee,
  ScannedEvent,
} from "@/lib/actions/check-in.actions";

/**
 * Records a scan. The identity of the scanner comes from the session, never
 * from the client — the payload says which event and which code, not who is
 * doing the scanning.
 */
export async function checkInAttendeeAction(
  input: unknown,
): Promise<CheckInResult> {
  const staff = await requireEventStaff();
  return checkInAttendee(staff.id, input);
}

export async function searchAttendeesAction(
  input: unknown,
): Promise<AttendeeMatch[]> {
  await requireEventStaff();
  return searchAttendees(input);
}
