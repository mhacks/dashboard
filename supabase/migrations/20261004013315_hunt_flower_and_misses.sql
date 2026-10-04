ALTER TABLE "hunt_progress" ADD COLUMN "flower" text;--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD COLUMN "petal_misses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD COLUMN "petal_locked_until" timestamp with time zone;