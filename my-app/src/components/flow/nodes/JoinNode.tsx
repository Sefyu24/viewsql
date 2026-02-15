"use client";

import type { NodeProps } from "@xyflow/react";
import type { JoinData } from "@/lib/sql/types";
import { FlowNodeShell } from "../shared/flow-node-shell";

/**
 * Flow node representing a JOIN operation.
 *
 * Green header. Shows the join type (INNER, LEFT, etc.) as a badge
 * and the ON condition as the body.
 */
export function JoinNode({ data }: NodeProps) {
  const d = data as unknown as JoinData;

  return (
    <FlowNodeShell
      title="JOIN"
      badge={d.joinType}
      headerColorClass="bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100"
    >
      {d.condition && (
        <div className="text-xs text-muted-foreground font-mono break-all">
          {d.condition}
        </div>
      )}
    </FlowNodeShell>
  );
}
