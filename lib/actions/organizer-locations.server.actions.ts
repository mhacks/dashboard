"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { organizerLocationSharing } from "@/lib/db/schema/organizer-locations";
import {
  OWNTRACKS_PATH,
  hashSharingToken,
  newSharingToken,
  owntracksConfigLink,
} from "@/lib/organizer-locations/owntracks";
import { getRequestOrigin } from "@/lib/url/request-origin";

const FIND_MY_ORGANIZER_PATH = "/find-my-organizer";
const MAX_DISPLAY_NAME = 40;

export type SharingSetup = {
  /** Opens the OwnTracks app and fills in every setting below. */
  configLink: string;
  url: string;
  username: string;
  password: string;
};

/* Errors are returned rather than thrown: production builds replace a thrown
   server-action message with a generic digest. */
type Result<T> = { data: T; error: null } | { data: null; error: string };

/**
 * Starts sharing, or issues a new password for someone already sharing (the
 * old one stops working at once). The password is returned this one time; only
 * its hash is stored.
 */
export async function startSharingLocation(
  displayName: string,
): Promise<Result<SharingSetup>> {
  const user = await requireOrganizer();
  const name = displayName.trim().replace(/\s+/g, " ");
  if (!name) return { data: null, error: "Enter the name hackers will see." };
  if (name.length > MAX_DISPLAY_NAME) {
    return {
      data: null,
      error: `Keep the name under ${MAX_DISPLAY_NAME} characters.`,
    };
  }

  const token = newSharingToken();
  await db
    .insert(organizerLocationSharing)
    .values({
      userId: user.id,
      displayName: name,
      tokenHash: hashSharingToken(token),
    })
    .onConflictDoUpdate({
      target: organizerLocationSharing.userId,
      set: { displayName: name, tokenHash: hashSharingToken(token) },
    });

  const origin = await getRequestOrigin();
  revalidatePath(FIND_MY_ORGANIZER_PATH);
  return {
    data: {
      configLink: owntracksConfigLink({
        origin,
        username: user.email,
        token,
        displayName: name,
      }),
      url: `${origin}${OWNTRACKS_PATH}`,
      username: user.email,
      password: token,
    },
    error: null,
  };
}

/** Stops sharing: revokes the password and, by cascade, deletes every point. */
export async function stopSharingLocation(): Promise<Result<true>> {
  const user = await requireOrganizer();
  await db
    .delete(organizerLocationSharing)
    .where(eq(organizerLocationSharing.userId, user.id));
  revalidatePath(FIND_MY_ORGANIZER_PATH);
  return { data: true, error: null };
}
