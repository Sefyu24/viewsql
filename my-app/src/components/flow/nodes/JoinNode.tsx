"use client";

import { useId } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronRight } from "lucide-react";
import type { JoinData } from "@/lib/sql/types";
import { ColumnList } from "../shared/column-list";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

/**
 * SVG Venn diagram representing a SQL JOIN.
 *
 * Uses diagonal line hatching instead of solid fills so the selected
 * regions are visually distinct without being heavy:
 * - INNER: only the intersection hatched
 * - LEFT:  entire left circle hatched
 * - RIGHT: entire right circle hatched
 * - FULL:  both circles hatched
 * - CROSS: both circles hatched
 *
 * The intersection region uses a denser cross-hatch to stand out from
 * the single-direction hatching on the outer regions.
 */
function VennDiagram({ joinType }: { joinType: JoinData["joinType"] }) {
  const id = useId();

  // Circle geometry within the viewBox
  const leftCx = 26;
  const rightCx = 46;
  const cy = 24;
  const r = 17;

  const hatchLeft = joinType === "LEFT" || joinType === "FULL" || joinType === "CROSS";
  const hatchRight = joinType === "RIGHT" || joinType === "FULL" || joinType === "CROSS";
  const hatchInner = joinType === "INNER";

  return (
    <svg viewBox="0 0 72 48" className="w-[72px] h-[48px]">
      <defs>
        {/* Diagonal lines going top-left to bottom-right */}
        <pattern
          id={`${id}-hatch`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0" y1="0" x2="0" y2="6"
            className="stroke-emerald-500 dark:stroke-emerald-400"
            strokeWidth={1.5}
          />
        </pattern>

        {/* Cross-hatch for intersection: two diagonal directions */}
        <pattern
          id={`${id}-crosshatch`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0" y1="0" x2="6" y2="6"
            className="stroke-emerald-500 dark:stroke-emerald-400"
            strokeWidth={1.2}
          />
          <line
            x1="6" y1="0" x2="0" y2="6"
            className="stroke-emerald-500 dark:stroke-emerald-400"
            strokeWidth={1.2}
          />
        </pattern>

        {/* Clip paths for circle regions */}
        <clipPath id={`${id}-clip-left`}>
          <circle cx={leftCx} cy={cy} r={r} />
        </clipPath>
        <clipPath id={`${id}-clip-right`}>
          <circle cx={rightCx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Left circle hatching (excluding intersection for LEFT — intersection gets cross-hatch) */}
      {hatchLeft && (
        <circle
          cx={leftCx}
          cy={cy}
          r={r}
          fill={`url(#${id}-hatch)`}
        />
      )}

      {/* Right circle hatching */}
      {hatchRight && (
        <circle
          cx={rightCx}
          cy={cy}
          r={r}
          fill={`url(#${id}-hatch)`}
        />
      )}

      {/* Cross-hatch on intersection for LEFT/RIGHT/FULL to show overlap is denser */}
      {(hatchLeft || hatchRight) && (
        <circle
          cx={rightCx}
          cy={cy}
          r={r}
          clipPath={`url(#${id}-clip-left)`}
          fill={`url(#${id}-crosshatch)`}
        />
      )}

      {/* INNER only: cross-hatch just the intersection */}
      {hatchInner && (
        <circle
          cx={rightCx}
          cy={cy}
          r={r}
          clipPath={`url(#${id}-clip-left)`}
          fill={`url(#${id}-crosshatch)`}
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
 * Hatched regions show which rows are included in the join result.
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

      {d.outputColumns && d.outputColumns.length > 0 && (
        <Collapsible className="w-full mt-2 pt-2 border-t border-dashed border-muted-foreground/20">
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors w-full group">
            <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
            Output — {d.outputColumns.length} columns
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <ColumnList
              columns={d.outputColumns}
              tableColorMap={d.tableColorMap}
              showSourceLabel
              maxVisible={999}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground !w-2 !h-2"
      />
    </div>
  );
}
