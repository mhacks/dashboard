import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as applicationInvitationsSchema from "./schema/application-invitations";
import * as applicationsSchema from "./schema/applications";
import * as blacklistSchema from "./schema/blacklist";
import * as broadcastsSchema from "./schema/broadcasts";
import * as emailSchema from "./schema/email";
import * as eventsSchema from "./schema/events";
import * as liveSchema from "./schema/live";
import * as rateLimiterSchema from "./schema/rate-limiter";
import * as reimbursementsSchema from "./schema/reimbursements";
import * as reservationSchema from "./schema/reservation";
import * as rsvpsSchema from "./schema/rsvps";
import * as userInvitationsSchema from "./schema/user-invitations";
import * as usersSchema from "./schema/users";
import * as teamsSchema from "./schema/teams";

// Disable prefetch — prepared statements are not supported in Supabase's
// "Transaction" pool mode (the pooled connection string on port 6543).
const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });

export const db = drizzle({
  client,
  schema: {
    ...applicationInvitationsSchema,
    ...applicationsSchema,
    ...blacklistSchema,
    ...broadcastsSchema,
    ...emailSchema,
    ...eventsSchema,
    ...liveSchema,
    ...rateLimiterSchema,
    ...reservationSchema,
    ...reimbursementsSchema,
    ...rsvpsSchema,
    ...userInvitationsSchema,
    ...usersSchema,
    ...teamsSchema,
  },
});
