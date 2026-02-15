"use client";

import { useId } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { JoinData } from "@/lib/sql/types";

/**
 * SVG Venn diagram representing a SQL JOIN.
 *
 * Two overlapping circles where the filled region indicates the join type:
 * - INNER: only the intersection
 * - LEFT:  entire left circle (including intersection)
 * - RIGHT: entire right circle (including intersection)
 * - FULL:  both circles entirely
 * - CROSS: both circles entirely (cartesian product)
 */
function VennDiagram({ joinType }: { joinType: JoinData["joinType"] }) {
  const id = useId();

  // Circle geometry within the viewBox
  const leftCx = 26;
  const rightCx = 46;
  const cy = 24;
  const r = 17;

  const fillLeft = joinType === "LEFT" || joinType === "FULL" || joinType === "CROSS";
  const fillRight = joinType === "RIGHT" || joinType === "FULL" || joinType === "CROSS";
  const fillInner = joinType === "INNER";

  return (
    <svg viewBox="0 0 72 48" className="w-[72px] h-[48px]">
      <defs>
        {/* Clip to left circle — used to draw the intersection */}
        <clipPath id={`${id}-clip-left`}>
          <circle cx={leftCx} cy={cy} r={r} />
        </clipPath>
        {/* Clip to right circle */}
        <clipPath id={`${id}-clip-right`}>
          <circle cx={rightCx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Left circle fill */}
      {fillLeft && (
        <circle cx={leftCx} cy={cy} r={r} className="fill-emerald-200 dark:fill-emerald-900/60" />
      )}

      {/* Right circle fill */}
      {fillRight && (
        <circle cx={rightCx} cy={cy} r={r} className="fill-emerald-200 dark:fill-emerald-900/60" />
      )}

      {/* INNER only: draw right circle clipped to left circle = intersection */}
      {fillInner && (
        <circle
          cx={rightCx}
          cy={cy}
          r={r}
          clipPath={`url(#${id}-clip-left)`}
          className="fill-emerald-300 dark:fill-emerald-800/80"
        />
      )}

      {/* Darker intersection overlay for LEFT/RIGHT/FULL to show the overlap */}
      {(fillLeft || fillRight) && (
        <circle
          cx={rightCx}
          cy={cy}
          r={r}
          clipPath={`url(#${id}-clip-left)`}
          className="fill-emerald-300/50 dark:fill-emerald-700/40"
        />
      )}

      {/* Circle outlines */}
      <circle
        cx={leftCx}
        cy={cy}
        r={r}
        fill="none"
        className="stroke-emerald-600 dark:stroke-emerald-400"
        strokeWidth={1.5}
      />
      <circle
        cx={rightCx}
        cy={cy}
        r={r}
        fill="none"
        className="stroke-emerald-600 dark:stroke-emerald-400"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/**
 * Flow node representing a JOIN operation as a Venn diagram.
 *
 * The filled region of the Venn communicates INNER/LEFT/RIGHT/FULL visually.
 * The join type label and ON condition are shown below the diagram.
 */
export function JoinNode({ data }: NodeProps) {
  const d = data as unknown as JoinData;

  return (
    <div className="flex flex-col items-center rounded-lg border bg-background shadow-sm px-3 py-2 min-w-[130px]">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground !w-2 !h-2"
      />

      <VennDiagram joinType={d.joinType} />

      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-1">
        {d.joinType} JOIN
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
