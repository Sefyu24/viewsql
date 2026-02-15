"use client";

import type { NodeProps } from "@xyflow/react";
import type { TableSourceData } from "@/lib/sql/types";
import { FlowNodeShell } from "../shared/flow-node-shell";
import { ColumnList } from "../shared/column-list";

/**
 * Flow node representing a source table in the query.
 *
 * Blue header. Shows table name (+ alias if present) and lists
 * columns with their data types.
 */
export function TableSourceNode({ data }: NodeProps) {
  const d = data as unknown as TableSourceData;
  const subtitle = d.alias ? `AS ${d.alias}` : undefined;

  return (
    <FlowNodeShell
      title={d.tableName}
      subtitle={subtitle}
      headerColorClass="bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100"
      showInput={false}
    >
      {d.columns.length > 0 && <ColumnList columns={d.columns} />}
    </FlowNodeShell>
  );
}
