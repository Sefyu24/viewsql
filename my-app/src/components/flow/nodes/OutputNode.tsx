"use client";

import type { NodeProps } from "@xyflow/react";
import type { OutputData } from "@/lib/sql/types";
import { FlowNodeShell } from "../shared/flow-node-shell";
import { ColumnList } from "../shared/column-list";
import { Badge } from "@/components/ui/badge";

/**
 * Flow node representing the final query output / result set.
 *
 * Green header. Shows the result columns with source lineage info,
 * plus ORDER BY and LIMIT if present.
 */
export function OutputNode({ data }: NodeProps) {
  const d = data as unknown as OutputData;

  return (
    <FlowNodeShell
      title="Result"
      headerColorClass="bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100"
      showOutput={false}
    >
      <div className="space-y-1.5">
        {d.columns.length > 0 && <ColumnList columns={d.columns} />}
        {(d.orderBy || d.limit !== undefined) && (
          <div className="flex gap-1 pt-1 border-t">
            {d.orderBy && (
              <Badge variant="outline" className="text-[10px]">
                ORDER BY {d.orderBy}
              </Badge>
            )}
            {d.limit !== undefined && (
              <Badge variant="outline" className="text-[10px]">
                LIMIT {d.limit}
              </Badge>
            )}
          </div>
        )}
      </div>
    </FlowNodeShell>
  );
}
