"use client";

import type { NodeProps } from "@xyflow/react";
import type { CTEData } from "@/lib/sql/types";
import { getTableColor } from "@/lib/flow/colors";
import { FlowNodeShell } from "../shared/flow-node-shell";
import { ColumnList } from "../shared/column-list";
import { Badge } from "@/components/ui/badge";

/**
 * Flow node representing a Common Table Expression (CTE / WITH clause).
 *
 * Header color is unique per CTE (assigned from the palette)
 * so the same color appears on matching output columns in the Result node.
 */
export function CTENode({ data }: NodeProps) {
  const d = data as unknown as CTEData;
  const color = getTableColor(d.colorIndex ?? 0);

  return (
    <FlowNodeShell
      title={d.cteName}
      badge="CTE"
      headerColorClass={color.header}
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
          <ColumnList columns={d.outputColumns} showSourceLabel={false} />
        )}
      </div>
    </FlowNodeShell>
  );
}
