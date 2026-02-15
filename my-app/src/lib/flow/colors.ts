/**
 * Color palette for table-source nodes.
 *
 * Each table in a query gets a unique color so users can visually trace
 * which columns in the output come from which source table. Colors are
 * chosen to be distinct, accessible in both light and dark themes.
 *
 * All Tailwind classes are written as full static strings so they are
 * picked up by Tailwind's content scanner.
 */

export type TableColor = {
  /** Full Tailwind class string for the node header (light + dark) */
  header: string;
  /** Full Tailwind class string for the output column row highlight (light + dark) */
  row: string;
  /** CSS color for the left border accent on output column rows */
  border: string;
};

const PALETTE: TableColor[] = [
  {
    header: "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100",
    row: "bg-blue-50 dark:bg-blue-950/40",
    border: "#3b82f6",
  },
  {
    header: "bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-100",
    row: "bg-rose-50 dark:bg-rose-950/40",
    border: "#f43f5e",
  },
  {
    header: "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-100",
    row: "bg-amber-50 dark:bg-amber-950/40",
    border: "#f59e0b",
  },
  {
    header: "bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-100",
    row: "bg-teal-50 dark:bg-teal-950/40",
    border: "#14b8a6",
  },
  {
    header: "bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-100",
    row: "bg-purple-50 dark:bg-purple-950/40",
    border: "#a855f7",
  },
  {
    header: "bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-100",
    row: "bg-orange-50 dark:bg-orange-950/40",
    border: "#f97316",
  },
  {
    header: "bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100",
    row: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "#6366f1",
  },
  {
    header: "bg-pink-100 dark:bg-pink-950 text-pink-900 dark:text-pink-100",
    row: "bg-pink-50 dark:bg-pink-950/40",
    border: "#ec4899",
  },
];

/**
 * Get a color from the palette by index. Wraps around if there are
 * more tables than colors.
 *
 * @param index - The table's index (order of appearance in the query).
 * @returns A TableColor object with all the CSS classes needed.
 */
export function getTableColor(index: number): TableColor {
  return PALETTE[index % PALETTE.length];
}
