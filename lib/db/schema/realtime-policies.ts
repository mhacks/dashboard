import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  authenticatedRole,
  realtimeMessages,
  realtimeTopic,
} from "drizzle-orm/supabase";
import { isOrganizerFn } from "./functions";

const reviewRealtimeTopic = sql`(
  ${realtimeTopic} = 'application-review:dashboard'
  OR ${realtimeTopic} LIKE 'application-review:%'
)`;

const inviteRealtimeTopic = sql`${realtimeTopic} = 'user-invites:dashboard'`;

export const organizersReceiveReviewRealtime = pgPolicy(
  "organizers_receive_review_realtime",
  {
    for: "select",
    to: authenticatedRole,
    using: sql`${isOrganizerFn} AND ${reviewRealtimeTopic}`,
  },
).link(realtimeMessages);

export const organizersSendReviewRealtime = pgPolicy(
  "organizers_send_review_realtime",
  {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${isOrganizerFn} AND ${reviewRealtimeTopic}`,
  },
).link(realtimeMessages);

export const organizersReceiveInviteRealtime = pgPolicy(
  "organizers_receive_invite_realtime",
  {
    for: "select",
    to: authenticatedRole,
    using: sql`${isOrganizerFn} AND ${inviteRealtimeTopic}`,
  },
).link(realtimeMessages);

export const organizersSendInviteRealtime = pgPolicy(
  "organizers_send_invite_realtime",
  {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${isOrganizerFn} AND ${inviteRealtimeTopic}`,
  },
).link(realtimeMessages);
