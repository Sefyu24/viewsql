"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type NodeProps,
  ReactFlowProvider,
} from "@xyflow/react";
import { Key } from "lucide-react";
import type { SchemaTable } from "@/lib/sql/introspect";
import { getTableColor } from "@/lib/flow/colors";
import "@xyflow/react/dist/style.css";

/* ── Mini table node ── */

type MiniTableData = {
  label: string;
  columns: { name: string; type: string; isPK: boolean; isFK: boolean }[];
  headerColor: string;
};

function MiniTableNode({ data }: NodeProps<Node<MiniTableData>>) {
  return (
    <div className="rounded-md border bg-background shadow-sm text-[10px] min-w-[130px] max-w-[170px]">
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-1.5 !h-1.5" />
      <div className={`px-2 py-1.5 rounded-t-md font-semibold text-xs truncate ${data.headerColor}`}>
        {data.label}
      </div>
      <div className="divide-y divide-border/50">
        {data.columns.map((col) => (
          <div key={col.name} className="flex items-center gap-1.5 px-2 py-0.5">
            {col.isPK && <Key className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
            {col.isFK && !col.isPK && <span className="text-[8px] text-muted-foreground shrink-0">FK</span>}
            {!col.isPK && !col.isFK && <span className="w-2.5 shrink-0" />}
            <span className="truncate flex-1 font-medium">{col.name}</span>
            <span className="text-muted-foreground shrink-0">{col.type}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-1.5 !h-1.5" />
    </div>
  );
}

const nodeTypes = { "mini-table": MiniTableNode };

/* ── Layout: simple grid (no ELK dependency for this small widget) ── */

function buildGraph(schema: SchemaTable[]) {
  const COL_WIDTH = 200;
  const COL_GAP = 80;
  const ROW_HEIGHT_PER_COL = 18;
  const ROW_GAP = 30;
  const HEADER_HEIGHT = 30;
  const COLS = 2;

  const nodes: Node<MiniTableData>[] = [];
  const edges: Edge[] = [];

  // Track cumulative heights per grid column for stacking
  const colYOffsets = new Array(COLS).fill(0);

  schema.forEach((table, i) => {
    const color = getTableColor(i);
    const gridCol = i % COLS;

    const nodeHeight = HEADER_HEIGHT + table.columns.length * ROW_HEIGHT_PER_COL + 8;
    const x = gridCol * (COL_WIDTH + COL_GAP);
    const y = colYOffsets[gridCol];
    colYOffsets[gridCol] += nodeHeight + ROW_GAP;

    nodes.push({
      id: table.name,
      type: "mini-table",
      position: { x, y },
      data: {
        label: table.name,
        headerColor: color.header,
        columns: table.columns.map((c) => ({
          name: c.name,
          type: c.dataType,
          isPK: c.isPrimaryKey,
          isFK: c.isForeignKey,
        })),
      },
    });

    // FK edges
    for (const col of table.columns) {
      if (col.isForeignKey && col.foreignTable && col.foreignTable !== table.name) {
        edges.push({
          id: `${table.name}.${col.name}->${col.foreignTable}`,
          source: col.foreignTable,
          target: table.name,
          type: "default",
          style: { stroke: "var(--color-muted-foreground)", strokeWidth: 1, strokeDasharray: "4 3" },
          animated: false,
        });
      }
    }
  });

  return { nodes, edges };
}

/* ── Main component ── */

function SchemaMap({ schema }: { schema: SchemaTable[] }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(schema),
    [schema]
  );

  const [nodes] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50);
  }, []);

  return (
    <div className="my-3 h-[220px] w-full rounded-lg border border-border/60 bg-card overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1}
      />
    </div>
  );
}

export function SchemaMiniMap({ schema }: { schema: SchemaTable[] }) {
  return (
    <ReactFlowProvider>
      <SchemaMap schema={schema} />
    </ReactFlowProvider>
  );
}
