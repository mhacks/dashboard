CREATE TABLE "rate_limiter_flexible" (
	"key" text PRIMARY KEY NOT NULL,
	"points" integer NOT NULL,
	"expire" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "rate_limiter_flexible" ENABLE ROW LEVEL SECURITY;