import { lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizerLocations } from "@/lib/db/schema/organizer-locations";
import { TRAIL_HOURS } from "@/lib/organizer-locations/display";
import {
  basicAuthCredentials,
  isOwntracksPassword,
  parseOwntracksLocation,
} from "@/lib/organizer-locations/owntracks";

export const dynamic = "force-dynamic";

/** A location message is a few hundred bytes; anything this big isn't one. */
const MAX_BODY_BYTES = 16 * 1024;

/*
  OwnTracks HTTP mode. The app POSTs one JSON message per request and expects a
  200 with a JSON array back; anything else and it keeps the message queued and
  retries. So every message we choose not to store (transitions, waypoints,
  malformed fixes) still gets `[]`, and only a bad password gets an error the
  phone will show in the app.
*/
function acknowledge() {
  return Response.json([]);
}

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MHacks find my organizer"' },
  });
}

export async function POST(request: Request) {
  const credentials = basicAuthCredentials(
    request.headers.get("authorization"),
  );
  if (!credentials || !isOwntracksPassword(credentials.password)) {
    return unauthorized();
  }
  const { name } = credentials;

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return acknowledge();

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return acknowledge();
  }

  const fix = parseOwntracksLocation(payload);
  if (!fix) return acknowledge();

  await db.transaction(async (tx) => {
    // The app resends queued fixes after a dropped connection; the primary key
    // on (name, recorded_at) makes a repeat a no-op.
    await tx
      .insert(organizerLocations)
      .values({ name, ...fix })
      .onConflictDoNothing();

    // Trim everyone, not just this phone, to the trail window: someone who
    // turns the app off sends nothing more, so their fixes would otherwise
    // never age out. Indexed on recorded_at, so this stays cheap.
    await tx
      .delete(organizerLocations)
      .where(
        lt(
          organizerLocations.recordedAt,
          sql`now() - make_interval(hours => ${TRAIL_HOURS})`,
        ),
      );
  });

  return acknowledge();
}
