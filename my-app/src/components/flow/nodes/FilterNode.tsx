"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FilterData } from "@/lib/sql/types";

/**
 * SVG funnel shape — wide on the left (input), narrow on the right (output).
 * Visually communicates "many rows in, fewer rows out."
 */
function FunnelIcon() {
  return (
    <svg viewBox="0 0 64 40" className="w-[64px] h-[40px]">
      {/* Funnel body: wide left tapering to narrow right */}
      <path
        d="M4,2 L4,38 L60,28 L60,12 Z"
        className="fill-amber-100 dark:fill-amber-900/50 stroke-amber-500 dark:stroke-amber-400"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Filter lines inside the funnel */}
      <line x1="20" y1="8" x2="20" y2="32" className="stroke-amber-400/60 dark:stroke-amber-500/40" strokeWidth={1} strokeDasharray="2 2" />
      <line x1="36" y1="11" x2="36" y2="29" className="stroke-amber-400/60 dark:stroke-amber-500/40" strokeWidth={1} strokeDasharray="2 2" />
    </svg>
  );
}

/**
 * Flow node representing a WHERE filter as a funnel shape.
 *
 * The funnel visually communicates that rows are being filtered down.
 * The condition is shown below the funnel.
 */
export function FilterNode({ data }: NodeProps) {
  const d = data as unknown as FilterData;

  return (
    <div className="flex flex-col items-center rounded-lg border bg-background shadow-sm px-3 py-2 min-w-[130px]">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground !w-2 !h-2"
      />

      <FunnelIcon />

      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1">
        WHERE
      </span>

      {d.condition && (
        <div className="text-[10px] text-muted-foreground font-mono mt-1 text-center break-all max-w-[160px] leading-tight">
          {d.condition}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground !w-2 !h-2"
      />
    </div>
  );
}
