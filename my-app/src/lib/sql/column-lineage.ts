import type { FlowGraph, FlowNode, ColumnRef } from "./types";

export type LineageEntry = {
  /** The output column name */
  outputColumn: string;
  /** Chain of sources: table → CTE → join → ... → output */
  sources: { table: string; column: string }[];
};

/**
 * Compute column lineage for the output node in a FlowGraph.
 *
 * Traces each output column backwards through the graph edges to find
 * which source table(s) and column(s) it originates from. Handles
 * direct references, CTE pass-throughs, and join chains.
 *
 * @param graph - A FlowGraph produced by sqlToFlowGraph().
 * @returns Array of LineageEntry objects, one per output column,
 *          each containing the source table/column chain.
 */
export function computeColumnLineage(graph: FlowGraph): LineageEntry[] {
  const nodeMap = new Map<string, FlowNode>(
    graph.nodes.map((n) => [n.id, n])
  );

  // Build reverse adjacency: target → source node IDs
  const incomingEdges = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const existing = incomingEdges.get(edge.target) ?? [];
    existing.push(edge.source);
    incomingEdges.set(edge.target, existing);
  }

  // Find the output node
  const outputNode = graph.nodes.find((n) => n.data.kind === "output");
  if (!outputNode || outputNode.data.kind !== "output") return [];

  const lineage: LineageEntry[] = [];

  for (const col of outputNode.data.columns) {
    const sources = traceColumn(col, outputNode.id, nodeMap, incomingEdges);
    lineage.push({
      outputColumn: col.name,
      sources,
    });
  }

  return lineage;
}

/**
 * Recursively trace a column reference backwards through the graph
 * to find its source table(s).
 */
function traceColumn(
  col: ColumnRef,
  currentNodeId: string,
  nodeMap: Map<string, FlowNode>,
  incomingEdges: Map<string, string[]>
): { table: string; column: string }[] {
  // If we already know the source table, return it
  if (col.sourceTable && col.sourceColumn) {
    // Check if the source is a real table (table-source node)
    for (const node of nodeMap.values()) {
      if (
        node.data.kind === "table-source" &&
        (node.data.tableName === col.sourceTable ||
          node.data.alias === col.sourceTable)
      ) {
        return [{ table: node.data.tableName, column: col.sourceColumn }];
      }
    }

    // Check if the source is a CTE
    for (const node of nodeMap.values()) {
      if (
        node.data.kind === "cte" &&
        node.data.cteName === col.sourceTable
      ) {
        // Look inside the CTE's output columns for further tracing
        const cteCol = node.data.outputColumns.find(
          (c) => c.name === col.sourceColumn
        );
        if (cteCol?.sourceTable && cteCol.sourceColumn) {
          return traceColumn(cteCol, node.id, nodeMap, incomingEdges);
        }
        return [{ table: col.sourceTable, column: col.sourceColumn }];
      }
    }
  }

  // Walk backwards through incoming edges
  const parents = incomingEdges.get(currentNodeId) ?? [];
  for (const parentId of parents) {
    const parentNode = nodeMap.get(parentId);
    if (!parentNode) continue;

    if (parentNode.data.kind === "table-source") {
      const matchingCol = parentNode.data.columns.find(
        (c) => c.name === col.name || c.name === col.sourceColumn
      );
      if (matchingCol) {
        return [
          {
            table: parentNode.data.tableName,
            column: matchingCol.name,
          },
        ];
      }
    }

    // Continue tracing upward
    const result = traceColumn(col, parentId, nodeMap, incomingEdges);
    if (result.length > 0) return result;
  }

  return [];
}
