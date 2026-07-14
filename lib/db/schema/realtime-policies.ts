import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  authenticatedRole,
  realtimeMessages,
  realtimeTopic,
} from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";

const reviewRealtimeTopic = sql`(
  ${realtimeTopic} = 'application-review:dashboard'
  OR ${realtimeTopic} LIKE 'application-review:%'
)`;

export const organizersReceiveReviewRealtime = pgPolicy(
  "organizers_receive_review_realtime",
  {
    for: "select",
    to: authenticatedRole,
    using: sql`${isOrganizer} AND ${reviewRealtimeTopic}`,
  },
).link(realtimeMessages);

export const organizersSendReviewRealtime = pgPolicy(
  "organizers_send_review_realtime",
  {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${isOrganizer} AND ${reviewRealtimeTopic}`,
  },
).link(realtimeMessages);
