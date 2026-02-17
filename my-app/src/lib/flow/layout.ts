import type { ELK, ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api";
import type { FlowGraph, FlowNode } from "@/lib/sql/types";

/**
 * Lazily load and instantiate ELK via dynamic import.
 *
 * The static `import ELK from "elkjs/lib/elk.bundled.js"` causes the WASM
 * module to be compiled at module evaluation time, which fails in Turbopack
 * when the fetch Response backing the WASM binary has already been consumed.
 * Dynamic import defers loading until the first layout request.
 */
let elkInstance: ELK | null = null;
async function getElk(): Promise<ELK> {
  if (!elkInstance) {
    const ELKConstructor = (await import("elkjs/lib/elk.bundled.js")).default;
    elkInstance = new ELKConstructor();
  }
  return elkInstance;
}

/** Estimated node width for compact nodes (join, filter, aggregation) */
const COMPACT_WIDTH = 200;
/** Estimated node width for nodes with columns (table-source, cte, output) */
const WIDE_WIDTH = 260;
/** Estimated height per column row inside a node */
const ROW_HEIGHT = 28;
/** Minimum node height */
const MIN_HEIGHT = 70;
/** Extra vertical buffer added to every node height for borders, padding, badges */
const HEIGHT_BUFFER = 16;
/** Vertical spacing between nodes in the same layer */
const NODE_SPACING = 60;
/** Horizontal spacing between layers (left-to-right distance) */
const LAYER_SPACING = 120;
/** Padding inside CTE group container nodes */
const GROUP_PADDING = 28;

/** Shared layout options for both root and compound nodes */
const SHARED_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": String(NODE_SPACING),
  "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_SPACING),
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
};

/**
 * Estimate the pixel dimensions of a flow node based on its data.
 *
 * Table-source, CTE, and output nodes use a wider width since they
 * display column lists. Join/filter/aggregation nodes are compact.
 * CTE group nodes return 0×0 since ELK computes their size from children.
 *
 * @param node - A FlowNode from the flow graph.
 * @returns Object with `width` and `height` in pixels.
 */
function estimateNodeSize(node: FlowNode): { width: number; height: number } {
  let rows = 1;
  let width = COMPACT_WIDTH;

  switch (node.data.kind) {
    case "cte-group":
      // ELK computes compound node size from its children
      return { width: 0, height: 0 };
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
    case "join": {
      // Venn diagram + label + condition + collapsed "Output — N columns" trigger
      const baseHeight = 100;
      const hasColumns = (node.data.outputColumns?.length ?? 0) > 0;
      return { width: WIDE_WIDTH, height: baseHeight + (hasColumns ? 28 : 0) + HEIGHT_BUFFER };
    }
    case "filter":
      // Funnel node — compact like the join node
      return { width: 160, height: 110 };
  }

  return {
    width,
    height: Math.max(MIN_HEIGHT, rows * ROW_HEIGHT + HEIGHT_BUFFER),
  };
}

/**
 * Compute automatic layout positions for a FlowGraph using ELK.js.
 *
 * Builds a hierarchical ELK graph: CTE group nodes become compound ElkNodes
 * with their tagged children nested inside. Edges where both endpoints are
 * inside the same group are placed on that group's edges array; cross-group
 * edges go on the root.
 *
 * @param graph - A FlowGraph with nodes and edges.
 * @returns Map of node ID → `{ x, y, width, height }`.
 */
export async function computeLayout(
  graph: FlowGraph
): Promise<Map<string, { x: number; y: number; width: number; height: number }>> {
  // Build lookup: nodeId → parentCteId
  const parentMap = new Map<string, string>();
  for (const node of graph.nodes) {
    if (node.parentCteId) {
      parentMap.set(node.id, node.parentCteId);
    }
  }

  // Collect group IDs
  const groupIds = new Set(
    graph.nodes
      .filter((n) => n.data.kind === "cte-group")
      .map((n) => n.id)
  );

  // Build ELK child nodes grouped by parent
  const groupChildren = new Map<string, ElkNode[]>();
  const rootChildren: ElkNode[] = [];

  for (const node of graph.nodes) {
    if (node.data.kind === "cte-group") {
      // Will be added as a compound node below
      groupChildren.set(node.id, []);
      continue;
    }

    const elkNode: ElkNode = {
      id: node.id,
      ...estimateNodeSize(node),
    };

    const parent = parentMap.get(node.id);
    if (parent && groupChildren.has(parent)) {
      groupChildren.get(parent)!.push(elkNode);
    } else {
      rootChildren.push(elkNode);
    }
  }

  // Build compound group nodes and add to root children
  for (const node of graph.nodes) {
    if (node.data.kind !== "cte-group") continue;

    const compoundNode: ElkNode = {
      id: node.id,
      layoutOptions: {
        ...SHARED_LAYOUT_OPTIONS,
        "elk.padding": `[top=${GROUP_PADDING + 24},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
      },
      children: groupChildren.get(node.id) ?? [],
      edges: [],
    };
    rootChildren.push(compoundNode);
  }

  // Partition edges: internal to a group vs cross-group (root)
  const groupEdges = new Map<string, ElkExtendedEdge[]>();
  for (const gid of groupIds) {
    groupEdges.set(gid, []);
  }
  const rootEdges: ElkExtendedEdge[] = [];

  for (const edge of graph.edges) {
    const sourceParent = parentMap.get(edge.source);
    const targetParent = parentMap.get(edge.target);

    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    };

    if (sourceParent && sourceParent === targetParent && groupIds.has(sourceParent)) {
      groupEdges.get(sourceParent)!.push(elkEdge);
    } else {
      rootEdges.push(elkEdge);
    }
  }

  // Attach internal edges to their compound nodes
  for (const child of rootChildren) {
    if (groupIds.has(child.id)) {
      child.edges = groupEdges.get(child.id) ?? [];
    }
  }

  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions: SHARED_LAYOUT_OPTIONS,
    children: rootChildren,
    edges: rootEdges,
  };

  const elk = await getElk();
  const layoutResult = await elk.layout(elkGraph);

  const positions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  // Extract positions from the layout result (handles nested compound nodes)
  function extractPositions(children: ElkNode[] | undefined) {
    for (const child of children ?? []) {
      positions.set(child.id, {
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? COMPACT_WIDTH,
        height: child.height ?? MIN_HEIGHT,
      });
      // Recurse into compound node children (positions are relative to parent)
      if (child.children && child.children.length > 0) {
        extractPositions(child.children);
      }
    }
  }

  extractPositions(layoutResult.children);

  return positions;
}
