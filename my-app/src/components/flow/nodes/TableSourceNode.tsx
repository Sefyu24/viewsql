"use client";

import type { NodeProps } from "@xyflow/react";
import type { TableSourceData } from "@/lib/sql/types";
import { getTableColor } from "@/lib/flow/colors";
import { FlowNodeShell } from "../shared/flow-node-shell";
import { ColumnList } from "../shared/column-list";

/**
 * Flow node representing a source table in the query.
 *
 * Header color is unique per table (assigned from the palette)
 * so the same color appears on matching output columns.
 */
export function TableSourceNode({ data }: NodeProps) {
  const d = data as unknown as TableSourceData;
  const subtitle = d.alias ? `AS ${d.alias}` : undefined;
  const color = getTableColor(d.colorIndex ?? 0);

  return (
    <FlowNodeShell
      title={d.tableName}
      subtitle={subtitle}
      headerColorClass={color.header}
      showInput={false}
    >
      {d.columns.length > 0 && <ColumnList columns={d.columns} />}
    </FlowNodeShell>
  );
}
