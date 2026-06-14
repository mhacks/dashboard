import { defineConfig } from "drizzle-kit";

// Migrations are written into supabase/migrations so the Supabase CLI applies
// them on `supabase start` / `supabase db reset` alongside any SQL migrations.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  // Emit `<timestamp>_name.sql` filenames the Supabase CLI recognizes.
  migrations: {
    prefix: "supabase",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
