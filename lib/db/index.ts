import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as applicationsSchema from "./schema/applications";
import * as blacklistSchema from "./schema/blacklist";
import * as emailSchema from "./schema/email";
import * as eventsSchema from "./schema/events";
import * as reimbursementsSchema from "./schema/reimbursements";
import * as rsvpsSchema from "./schema/rsvps";
import * as userInvitationsSchema from "./schema/user-invitations";
import * as usersSchema from "./schema/users";

// Disable prefetch — prepared statements are not supported in Supabase's
// "Transaction" pool mode (the pooled connection string on port 6543).
const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });

export const db = drizzle({
  client,
  schema: {
    ...applicationsSchema,
    ...blacklistSchema,
    ...emailSchema,
    ...eventsSchema,
    ...reimbursementsSchema,
    ...rsvpsSchema,
    ...userInvitationsSchema,
    ...usersSchema,
  },
});
