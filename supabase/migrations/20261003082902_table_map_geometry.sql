ALTER TABLE "judging_settings" ADD COLUMN "map_columns" integer DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_settings" ADD COLUMN "map_rows" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "origin_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "origin_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "width" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "height" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_settings" ADD CONSTRAINT "judging_settings_map_columns_range" CHECK ("judging_settings"."map_columns" >= 1 AND "judging_settings"."map_columns" <= 40);--> statement-breakpoint
ALTER TABLE "judging_settings" ADD CONSTRAINT "judging_settings_map_rows_range" CHECK ("judging_settings"."map_rows" >= 1 AND "judging_settings"."map_rows" <= 40);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_origin_nonnegative" CHECK ("tables"."origin_x" >= 0 AND "tables"."origin_y" >= 0);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_size_positive" CHECK ("tables"."width" >= 1 AND "tables"."height" >= 1);--> statement-breakpoint
WITH ranked AS (
  SELECT id, (row_number() OVER (ORDER BY number, id) - 1) AS idx
  FROM tables
)
UPDATE tables AS t
SET
  origin_x = ranked.idx % 8,
  origin_y = ranked.idx / 8,
  width = 1,
  height = 1
FROM ranked
WHERE t.id = ranked.id;--> statement-breakpoint
UPDATE judging_settings
SET
  map_columns = LEAST(
    40,
    GREATEST(
      map_columns,
      COALESCE((SELECT MAX(origin_x + width) FROM tables), 1)
    )
  ),
  map_rows = LEAST(
    40,
    GREATEST(
      map_rows,
      COALESCE((SELECT MAX(origin_y + height) FROM tables), 1)
    )
  );