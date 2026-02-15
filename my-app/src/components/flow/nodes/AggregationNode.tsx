"use client";

import type { NodeProps } from "@xyflow/react";
import type { AggregationData } from "@/lib/sql/types";
import { FlowNodeShell } from "../shared/flow-node-shell";
import { Badge } from "@/components/ui/badge";

/**
 * Flow node representing a GROUP BY + aggregate operation.
 *
 * Violet header. Shows GROUP BY columns and aggregate function calls
 * (COUNT, SUM, etc.).
 */
export function AggregationNode({ data }: NodeProps) {
  const d = data as unknown as AggregationData;

  return (
    <FlowNodeShell
      title="GROUP BY"
      headerColorClass="bg-violet-100 dark:bg-violet-950 text-violet-900 dark:text-violet-100"
    >
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {d.groupByColumns.map((col, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">
              {col}
            </Badge>
          ))}
        </div>
        {d.aggregates.length > 0 && (
          <div className="space-y-0.5">
            {d.aggregates.map((agg, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground">
                {agg}
              </div>
            ))}
          </div>
        )}
      </div>
    </FlowNodeShell>
  );
}
