import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as applicationsSchema from "./schema/applications";
import * as userInvitationsSchema from "./schema/user-invitations";
import * as eventsSchema from "./schema/events";
import * as usersSchema from "./schema/users";
import * as reimbursementsSchema from "./schema/reimbursements";
import * as blacklistSchema from "./schema/blacklist";

// Disable prefetch — prepared statements are not supported in Supabase's
// "Transaction" pool mode (the pooled connection string on port 6543).
const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });

export const db = drizzle({
  client,
  schema: {
    ...applicationsSchema,
    ...usersSchema,
    ...userInvitationsSchema,
    ...reimbursementsSchema,
    ...blacklistSchema,
    ...eventsSchema,
  },
});
