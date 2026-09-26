import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// rate-limiter-flexible RateLimiterDrizzle* expects key / points / expire.
export const rateLimiterFlexible = pgTable("rate_limiter_flexible", {
  key: text("key").primaryKey().notNull(),
  points: integer("points").notNull(),
  expire: timestamp("expire", { withTimezone: true }),
}).enableRLS();
