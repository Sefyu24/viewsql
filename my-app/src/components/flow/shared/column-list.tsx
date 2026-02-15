"use client";

import type { ColumnRef } from "@/lib/sql/types";

/**
 * Reusable column list displayed inside flow nodes.
 *
 * Shows each column with its name, optional data type, and optional
 * PK/FK badges. Used by table-source, CTE, and output nodes.
 *
 * @param columns - Array of ColumnRef objects to display.
 * @param maxVisible - Maximum number of columns to show before truncating
 *                     with a "+N more" indicator. Defaults to 8.
 */
export function ColumnList({
  columns,
  maxVisible = 8,
}: {
  columns: ColumnRef[];
  maxVisible?: number;
}) {
  const visible = columns.slice(0, maxVisible);
  const remaining = columns.length - maxVisible;

  return (
    <div className="space-y-0.5">
      {visible.map((col, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
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
      ))}
      {remaining > 0 && (
        <div className="text-muted-foreground/60 text-[10px]">
          +{remaining} more
        </div>
      )}
    </div>
  );
}
