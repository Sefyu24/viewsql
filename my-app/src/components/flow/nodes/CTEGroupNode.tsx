"use client";

import type { NodeProps } from "@xyflow/react";
import type { CTEGroupData } from "@/lib/sql/types";
import { getTableColor } from "@/lib/flow/colors";

/**
 * Container node that wraps all inner nodes belonging to a single CTE pipeline.
 *
 * Renders a rounded rectangle with a semi-transparent colored background and
 * a CTE name label in the top-left corner. No handles — edges connect to the
 * CTE result node inside, not to the group itself.
 *
 * The actual width/height is set via the `style` prop by the layout engine,
 * so this component just fills its container.
 */
export function CTEGroupNode({ data }: NodeProps) {
  const d = data as unknown as CTEGroupData;
  const color = getTableColor(d.colorIndex);

  return (
    <div
      className="w-full h-full rounded-xl border-2 border-dashed"
      style={{
        borderColor: color.border,
        backgroundColor: `${color.border}0d`,
      }}
    >
      <div
        className="absolute top-2 left-3 text-xs font-semibold px-2 py-0.5 rounded"
        style={{
          color: color.border,
          backgroundColor: `${color.border}1a`,
        }}
      >
        {d.cteName}
      </div>
    </div>
  );
}
