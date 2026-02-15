"use client";

import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

/**
 * Custom edge component for the flow diagram.
 *
 * Renders a bezier curve with an optional label showing column names
 * that flow along this connection. Used between all node types.
 */
export function ColumnFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const columns = (data as { columns?: string[] })?.columns;
  const label =
    columns && columns.length > 0 && columns.length <= 3
      ? columns.join(", ")
      : undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} />
      {label && (
        <foreignObject
          x={labelX - 50}
          y={labelY - 10}
          width={100}
          height={20}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center">
            <span className="rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground border whitespace-nowrap">
              {label}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
}
