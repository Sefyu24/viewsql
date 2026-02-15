import type { EdgeTypes } from "@xyflow/react";
import { ColumnFlowEdge } from "@/components/flow/edges/ColumnFlowEdge";

/**
 * Registry of custom edge types for React Flow.
 *
 * Defined outside of components to prevent re-renders.
 */
export const edgeTypes: EdgeTypes = {
  columnFlow: ColumnFlowEdge,
};
