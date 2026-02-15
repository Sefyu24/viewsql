"use client";

import type { NodeProps } from "@xyflow/react";
import type { CTEData } from "@/lib/sql/types";
import { FlowNodeShell } from "../shared/flow-node-shell";
import { ColumnList } from "../shared/column-list";
import { Badge } from "@/components/ui/badge";

/**
 * Flow node representing a Common Table Expression (CTE / WITH clause).
 *
 * Cyan header. Shows CTE name, output columns, and inline badges
 * indicating if it contains WHERE or GROUP BY clauses.
 */
export function CTENode({ data }: NodeProps) {
  const d = data as unknown as CTEData;

  return (
    <FlowNodeShell
      title={d.cteName}
      badge="CTE"
      headerColorClass="bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-100"
    >
      <div className="space-y-1.5">
        {(d.hasWhere || d.hasGroupBy) && (
          <div className="flex gap-1">
            {d.hasWhere && (
              <Badge variant="outline" className="text-[10px]">
                WHERE
              </Badge>
            )}
            {d.hasGroupBy && (
              <Badge variant="outline" className="text-[10px]">
                GROUP BY
              </Badge>
            )}
          </div>
        )}
        {d.outputColumns.length > 0 && (
          <ColumnList columns={d.outputColumns} />
        )}
      </div>
    </FlowNodeShell>
  );
}
