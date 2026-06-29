import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/applications";
import * as usersSchema from "./schema/users";

// Disable prefetch — prepared statements are not supported in Supabase's
// "Transaction" pool mode (the pooled connection string on port 6543).
const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });

export const db = drizzle({ client, schema: { ...schema, ...usersSchema } });
