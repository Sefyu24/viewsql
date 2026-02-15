"use client";

import type { ColumnRef } from "@/lib/sql/types";
import { getTableColor } from "@/lib/flow/colors";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
 * @param showSourceLabel - Whether to show the source table name on each row.
 *                          Defaults to true. Set to false inside table-source nodes
 *                          where the source is already obvious from the node header.
 * @param maxVisible - Maximum number of columns to show before truncating
 *                     with a "+N more" indicator. Defaults to 8.
 */
export function ColumnList({
  columns,
  tableColorMap,
  showSourceLabel = true,
  maxVisible = 8,
}: {
  columns: ColumnRef[];
  tableColorMap?: Record<string, number>;
  showSourceLabel?: boolean;
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

        const tooltipText = [col.name, col.dataType, col.sourceTable]
          .filter(Boolean)
          .join(" · ");

        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
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
                {showSourceLabel && col.sourceTable && (
                  <span className="ml-auto text-muted-foreground/60 shrink-0 text-[10px]">
                    {col.sourceTable}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
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
