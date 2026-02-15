"use client";

import type { NodeProps } from "@xyflow/react";
import type { FilterData } from "@/lib/sql/types";
import { FlowNodeShell } from "../shared/flow-node-shell";

/**
 * Flow node representing a WHERE filter.
 *
 * Amber header. Shows the filter condition in the body.
 */
export function FilterNode({ data }: NodeProps) {
  const d = data as unknown as FilterData;

  return (
    <FlowNodeShell
      title="WHERE"
      headerColorClass="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-100"
    >
      <div className="text-xs text-muted-foreground font-mono break-all">
        {d.condition}
      </div>
    </FlowNodeShell>
  );
}
