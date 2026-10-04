ALTER TABLE "hunt_progress" ADD COLUMN "petal_code" text;--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD COLUMN "petal_found_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD CONSTRAINT "hunt_progress_petal_code_unique" UNIQUE("petal_code");