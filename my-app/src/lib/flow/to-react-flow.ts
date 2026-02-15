import type { Node, Edge } from "@xyflow/react";
import type { FlowGraph, FlowNodeData } from "@/lib/sql/types";
import { computeLayout } from "./layout";

/**
 * Convert a FlowGraph (our domain model) into React Flow nodes and edges
 * with ELK-computed positions.
 *
 * Each FlowNode maps to a React Flow Node with a custom type matching
 * its `kind` (e.g., "table-source", "join", "filter"). Each FlowEdge
 * maps to a React Flow Edge with animation and label properties.
 *
 * CTE group nodes are emitted as parent nodes. Child nodes within a CTE
 * group get `parentId` and `extent: "parent"` set. Parent nodes are
 * placed before their children in the array (React Flow requirement).
 *
 * @param graph - A FlowGraph produced by sqlToFlowGraph().
 * @returns Object containing `nodes` and `edges` arrays ready for React Flow.
 */
export async function flowGraphToReactFlow(
  graph: FlowGraph
): Promise<{ nodes: Node<FlowNodeData>[]; edges: Edge[] }> {
  const positions = await computeLayout(graph);

  // Separate parent (group) nodes from others so parents come first
  const parentNodes: Node<FlowNodeData>[] = [];
  const childNodes: Node<FlowNodeData>[] = [];

  for (const node of graph.nodes) {
    const pos = positions.get(node.id) ?? { x: 0, y: 0, width: 220, height: 60 };

    const rfNode: Node<FlowNodeData> = {
      id: node.id,
      type: node.data.kind,
      position: { x: pos.x, y: pos.y },
      data: node.data,
      style: {
        width: pos.width,
        height: pos.height,
        background: "transparent",
        border: "none",
        padding: 0,
      },
    };

    if (node.data.kind === "cte-group") {
      parentNodes.push(rfNode);
    } else if (node.parentCteId) {
      rfNode.parentId = node.parentCteId;
      rfNode.extent = "parent";
      childNodes.push(rfNode);
    } else {
      childNodes.push(rfNode);
    }
  }

  // React Flow requires parent nodes to appear before their children
  const nodes = [...parentNodes, ...childNodes];

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.animated ?? true,
    label: edge.label,
    type: "columnFlow",
    data: { columns: edge.columns },
  }));

  return { nodes, edges };
}
