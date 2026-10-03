-- Column defaults park every existing table on cell (0, 0). Spread them onto
-- the same 2×1 packing as defaultTableGeometry so they do not share a cell.
-- A later seed may replace these coordinates.
WITH numbered AS (
  SELECT
    id,
    (row_number() OVER (ORDER BY number) - 1)::integer AS idx,
    count(*) OVER ()::integer AS table_count
  FROM public.tables
),
settings AS (
  SELECT COALESCE(MAX(map_columns), 28)::integer AS map_columns
  FROM public.judging_settings
),
packing AS (
  SELECT
    GREATEST(1, LEAST(20, settings.map_columns / 2))::integer AS map_per_row,
    20::integer AS max_per_row,
    39::integer AS max_row
  FROM settings
),
chosen AS (
  SELECT
    CASE
      WHEN (numbered.table_count - 1) / packing.map_per_row <= packing.max_row
        THEN packing.map_per_row
      ELSE packing.max_per_row
    END AS per_row
  FROM numbered
  CROSS JOIN packing
  LIMIT 1
)
UPDATE public.tables AS target
SET
  origin_x = (numbered.idx % chosen.per_row) * 2,
  origin_y = numbered.idx / chosen.per_row,
  width = 2,
  height = 1
FROM numbered
CROSS JOIN chosen
WHERE target.id = numbered.id;
