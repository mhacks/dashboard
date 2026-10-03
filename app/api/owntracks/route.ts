import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizerLocationSharing,
  organizerLocations,
} from "@/lib/db/schema/organizer-locations";
import { users } from "@/lib/db/schema/users";
import { TRAIL_HOURS } from "@/lib/organizer-locations/display";
import {
  basicAuthPassword,
  hashSharingToken,
  parseOwntracksLocation,
} from "@/lib/organizer-locations/owntracks";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

export const dynamic = "force-dynamic";

/** A location message is a few hundred bytes; anything this big isn't one. */
const MAX_BODY_BYTES = 16 * 1024;

/*
  Per minute. The address limit runs before the password check, so password
  guessing and junk traffic stop at the limiter; it is loose because every
  organizer on campus Wi-Fi or one carrier's NAT can share an address. The
  per-organizer limit caps writes: a phone flushing its queue after a dead zone
  bursts, and past this the app keeps the rest queued and retries later.
*/
const addressLimiter = drizzleRateLimiter("owntracks:address", 300);
const sharerLimiter = drizzleRateLimiter("owntracks:sharer", 60);

/*
  OwnTracks HTTP mode. The app POSTs one JSON message per request and expects a
  200 with a JSON array back; anything else and it keeps the message queued and
  retries. So every message we choose not to store (transitions, waypoints,
  malformed fixes) still gets `[]`. Only a bad password (401) or a rate limit
  (429, which the app retries) gets an error.
*/
function acknowledge() {
  return Response.json([]);
}

function tooManyRequests(message: string) {
  return new Response(message, {
    status: 429,
    headers: { "Retry-After": "60" },
  });
}

/**
 * The load balancer appends the address it saw to X-Forwarded-For, so the
 * last entry is the one a client can't forge.
 */
function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || "unknown";
}

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MHacks find my organizer"' },
  });
}

export async function POST(request: Request) {
  const addressBlocked = await rateLimitMessage(
    addressLimiter,
    clientAddress(request),
    "Too many requests from this address.",
  );
  if (addressBlocked) return tooManyRequests(addressBlocked);

  const password = basicAuthPassword(request.headers.get("authorization"));
  if (!password) return unauthorized();

  const [sharer] = await db
    .select({ userId: organizerLocationSharing.userId })
    .from(organizerLocationSharing)
    // A demoted organizer's password stops working without them stopping.
    .innerJoin(
      users,
      and(
        eq(users.id, organizerLocationSharing.userId),
        eq(users.role, "organizer"),
      ),
    )
    .where(eq(organizerLocationSharing.tokenHash, hashSharingToken(password)))
    .limit(1);
  if (!sharer) return unauthorized();

  const sharerBlocked = await rateLimitMessage(
    sharerLimiter,
    sharer.userId,
    "Too many location updates.",
  );
  if (sharerBlocked) return tooManyRequests(sharerBlocked);

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
    // on (user, recorded_at) makes a repeat a no-op.
    await tx
      .insert(organizerLocations)
      .values({ userId: sharer.userId, ...fix })
      .onConflictDoNothing();

    // Trim to the trail window, but never delete someone's newest fix: a phone
    // that has been off for hours should still show where it was last seen.
    await tx
      .delete(organizerLocations)
      .where(
        and(
          eq(organizerLocations.userId, sharer.userId),
          lt(
            organizerLocations.recordedAt,
            sql`now() - make_interval(hours => ${TRAIL_HOURS})`,
          ),
          lt(
            organizerLocations.recordedAt,
            sql`(select max(${organizerLocations.recordedAt}) from ${organizerLocations} where ${organizerLocations.userId} = ${sharer.userId})`,
          ),
        ),
      );
  });

  return acknowledge();
}
