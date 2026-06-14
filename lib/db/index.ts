import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | null = null;

function getDb(): Database {
  if (instance) return instance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Disable prefetch — prepared statements are not supported in Supabase's
  // "Transaction" pool mode (the pooled connection string on port 6543).
  const client = postgres(connectionString, { prepare: false });
  instance = drizzle({ client, schema });
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
