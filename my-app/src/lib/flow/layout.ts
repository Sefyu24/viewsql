import ELK, { type ElkNode, type ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import type { FlowGraph, FlowNode } from "@/lib/sql/types";

const elk = new ELK();

/** Estimated node width based on content */
const BASE_WIDTH = 220;
/** Estimated height per column row inside a node */
const ROW_HEIGHT = 24;
/** Minimum node height */
const MIN_HEIGHT = 60;
/** Padding between nodes */
const NODE_SPACING = 40;
/** Padding between layers (left-to-right distance) */
const LAYER_SPACING = 80;

/**
 * Estimate the pixel dimensions of a flow node based on its data.
 *
 * Table-source and output nodes are taller because they list columns.
 * Join/filter/aggregation nodes are compact.
 *
 * @param node - A FlowNode from the flow graph.
 * @returns Object with `width` and `height` in pixels.
 */
function estimateNodeSize(node: FlowNode): { width: number; height: number } {
  let rows = 1;

  switch (node.data.kind) {
    case "table-source":
      rows = Math.max(node.data.columns.length, 1) + 1;
      break;
    case "cte":
      rows = Math.max(node.data.outputColumns.length, 1) + 1;
      break;
    case "output":
      rows = Math.max(node.data.columns.length, 1) + 1;
      break;
    case "aggregation":
      rows = node.data.groupByColumns.length + node.data.aggregates.length + 1;
      break;
    case "join":
    case "filter":
      rows = 2;
      break;
  }

  return {
    width: BASE_WIDTH,
    height: Math.max(MIN_HEIGHT, rows * ROW_HEIGHT + 16),
  };
}

/**
 * Compute automatic layout positions for a FlowGraph using ELK.js.
 *
 * Uses a layered (Sugiyama) algorithm with left-to-right direction
 * and orthogonal edge routing. Returns a map of node IDs to their
 * computed `{ x, y, width, height }` positions.
 *
 * @param graph - A FlowGraph with nodes and edges.
 * @returns Map of node ID → `{ x, y, width, height }`.
 */
export async function computeLayout(
  graph: FlowGraph
): Promise<Map<string, { x: number; y: number; width: number; height: number }>> {
  const elkNodes: ElkNode[] = graph.nodes.map((node) => {
    const size = estimateNodeSize(node);
    return {
      id: node.id,
      width: size.width,
      height: size.height,
    };
  });

  const elkEdges: ElkExtendedEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": String(NODE_SPACING),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_SPACING),
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const layoutResult = await elk.layout(elkGraph);

  const positions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  for (const child of layoutResult.children ?? []) {
    positions.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? BASE_WIDTH,
      height: child.height ?? MIN_HEIGHT,
    });
  }

  return positions;
}
