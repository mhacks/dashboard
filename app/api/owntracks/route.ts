import { lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizerLocations } from "@/lib/db/schema/organizer-locations";
import { ORGANIZER_WINDOW_HOURS } from "@/lib/organizer-locations/display";
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

  // One row per person. The app delivers queued fixes late and resends them
  // after a dropped connection, so an older fix never replaces a newer one.
  await db
    .insert(organizerLocations)
    .values({ name, ...fix })
    .onConflictDoUpdate({
      target: organizerLocations.name,
      set: {
        latitude: sql`excluded.latitude`,
        longitude: sql`excluded.longitude`,
        accuracy: sql`excluded.accuracy`,
        battery: sql`excluded.battery`,
        recordedAt: sql`excluded.recorded_at`,
        receivedAt: sql`now()`,
      },
      setWhere: sql`excluded.recorded_at > ${organizerLocations.recordedAt}`,
    });

  // Someone who turns the app off sends nothing more, so their row is cleared
  // by whoever posts next. Indexed on recorded_at, so this stays cheap.
  await db
    .delete(organizerLocations)
    .where(
      lt(
        organizerLocations.recordedAt,
        sql`now() - make_interval(hours => ${ORGANIZER_WINDOW_HOURS})`,
      ),
    );

  return acknowledge();
}
