import type { NodeTypes } from "@xyflow/react";
import { TableSourceNode } from "@/components/flow/nodes/TableSourceNode";
import { JoinNode } from "@/components/flow/nodes/JoinNode";
import { FilterNode } from "@/components/flow/nodes/FilterNode";
import { AggregationNode } from "@/components/flow/nodes/AggregationNode";
import { CTENode } from "@/components/flow/nodes/CTENode";
import { CTEGroupNode } from "@/components/flow/nodes/CTEGroupNode";
import { OutputNode } from "@/components/flow/nodes/OutputNode";

/**
 * Registry of custom node types for React Flow.
 *
 * Defined outside of components to prevent re-renders. Each key matches
 * the `kind` field in our FlowNodeData discriminated union.
 */
export const nodeTypes: NodeTypes = {
  "table-source": TableSourceNode,
  join: JoinNode,
  filter: FilterNode,
  aggregation: AggregationNode,
  cte: CTENode,
  "cte-group": CTEGroupNode,
  output: OutputNode,
};
