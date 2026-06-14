import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// `prepare: false` is required when pointing at Supabase's transaction pooler.
// For local dev (direct connection on 54322) it is harmless.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
