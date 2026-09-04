export const DEFAULT_COLUMNS = 8;

export function toRows<T>(
  items: T[],
  columns: number = DEFAULT_COLUMNS,
): T[][] {
  if (columns < 1) {
    throw new Error("columns must be at least 1");
  }

  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}
