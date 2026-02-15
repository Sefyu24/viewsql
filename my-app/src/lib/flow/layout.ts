import ELK, { type ElkNode, type ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import type { FlowGraph, FlowNode } from "@/lib/sql/types";

const elk = new ELK();

/** Estimated node width for compact nodes (join, filter, aggregation) */
const COMPACT_WIDTH = 200;
/** Estimated node width for nodes with columns (table-source, cte, output) */
const WIDE_WIDTH = 260;
/** Estimated height per column row inside a node */
const ROW_HEIGHT = 24;
/** Minimum node height */
const MIN_HEIGHT = 60;
/** Vertical spacing between nodes in the same layer */
const NODE_SPACING = 50;
/** Horizontal spacing between layers (left-to-right distance) */
const LAYER_SPACING = 100;

/**
 * Estimate the pixel dimensions of a flow node based on its data.
 *
 * Table-source, CTE, and output nodes use a wider width since they
 * display column lists. Join/filter/aggregation nodes are compact.
 *
 * @param node - A FlowNode from the flow graph.
 * @returns Object with `width` and `height` in pixels.
 */
function estimateNodeSize(node: FlowNode): { width: number; height: number } {
  let rows = 1;
  let width = COMPACT_WIDTH;

  switch (node.data.kind) {
    case "table-source":
      rows = Math.max(node.data.columns.length, 1) + 1;
      width = WIDE_WIDTH;
      break;
    case "cte":
      rows = Math.max(node.data.outputColumns.length, 1) + 1;
      if (node.data.hasWhere || node.data.hasGroupBy) rows += 1;
      width = WIDE_WIDTH;
      break;
    case "output":
      rows = Math.max(node.data.columns.length, 1) + 1;
      width = WIDE_WIDTH;
      break;
    case "aggregation":
      rows = node.data.groupByColumns.length + node.data.aggregates.length + 1;
      break;
    case "join":
      rows = 3;
      break;
    case "filter":
      rows = 2;
      break;
  }

  return {
    width,
    height: Math.max(MIN_HEIGHT, rows * ROW_HEIGHT + 20),
  };
}

/**
 * Compute automatic layout positions for a FlowGraph using ELK.js.
 *
 * Uses a layered (Sugiyama) algorithm with left-to-right direction.
 * Nodes are arranged in layers based on their dependencies, with
 * parallel pipelines (e.g. CTE branches) placed in separate rows.
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
      // Place nodes with no shared edges into separate parallel lanes
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      // Improve vertical alignment within each layer
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      // Reduce unnecessary edge crossings
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
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
      width: child.width ?? COMPACT_WIDTH,
      height: child.height ?? MIN_HEIGHT,
    });
  }

  return positions;
}
