"use client";

import type { ColumnRef } from "@/lib/sql/types";
import { getTableColor } from "@/lib/flow/colors";

/**
 * Reusable column list displayed inside flow nodes.
 *
 * Shows each column with its name, optional data type, and source table label.
 * When `tableColorMap` is provided, each row is highlighted with the color
 * of its source table — making it easy to visually trace column origins.
 *
 * @param columns - Array of ColumnRef objects to display.
 * @param tableColorMap - Optional map of table name → color palette index.
 *                        When set, rows get a colored left border and background.
 * @param maxVisible - Maximum number of columns to show before truncating
 *                     with a "+N more" indicator. Defaults to 8.
 */
export function ColumnList({
  columns,
  tableColorMap,
  maxVisible = 8,
}: {
  columns: ColumnRef[];
  tableColorMap?: Record<string, number>;
  maxVisible?: number;
}) {
  const visible = columns.slice(0, maxVisible);
  const remaining = columns.length - maxVisible;

  return (
    <div className="space-y-0.5">
      {visible.map((col, i) => {
        const colorIndex =
          tableColorMap && col.sourceTable
            ? tableColorMap[col.sourceTable]
            : undefined;
        const color = colorIndex !== undefined ? getTableColor(colorIndex) : null;

        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 ${
              color ? `${color.row} border-l-2` : ""
            }`}
            style={color ? { borderLeftColor: color.border } : undefined}
          >
            <span className="font-medium text-foreground truncate">
              {col.name}
            </span>
            {col.dataType && (
              <span className="text-muted-foreground truncate">
                {col.dataType}
              </span>
            )}
            {col.sourceTable && (
              <span className="ml-auto text-muted-foreground/60 truncate text-[10px]">
                {col.sourceTable}
              </span>
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <div className="text-muted-foreground/60 text-[10px]">
          +{remaining} more
        </div>
      )}
    </div>
  );
}
