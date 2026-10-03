ALTER TABLE "judging_settings" ADD COLUMN "map_columns" integer DEFAULT 28 NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_settings" ADD COLUMN "map_rows" integer DEFAULT 22 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "origin_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "origin_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "width" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "height" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_settings" ADD CONSTRAINT "judging_settings_map_columns_range" CHECK ("judging_settings"."map_columns" >= 1 AND "judging_settings"."map_columns" <= 40);--> statement-breakpoint
ALTER TABLE "judging_settings" ADD CONSTRAINT "judging_settings_map_rows_range" CHECK ("judging_settings"."map_rows" >= 1 AND "judging_settings"."map_rows" <= 40);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_origin_nonnegative" CHECK ("tables"."origin_x" >= 0 AND "tables"."origin_y" >= 0);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_size_positive" CHECK ("tables"."width" >= 1 AND "tables"."height" >= 1);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_geometry_within_map" CHECK ("tables"."origin_x" + "tables"."width" <= 40 AND "tables"."origin_y" + "tables"."height" <= 40);