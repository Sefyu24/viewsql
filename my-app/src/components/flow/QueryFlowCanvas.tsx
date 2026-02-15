"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "@/lib/flow/node-types";
import { edgeTypes } from "@/lib/flow/edge-types";
import { sqlToFlowGraph } from "@/lib/sql/ast-to-graph";
import { flowGraphToReactFlow } from "@/lib/flow/to-react-flow";
import type { SchemaTable } from "@/lib/sql/introspect";
import type { FlowNodeData } from "@/lib/sql/types";

/**
 * Main React Flow canvas that visualizes a SQL query as a flow diagram.
 *
 * Takes a SQL string and optional schema info, parses the query into
 * a flow graph, computes layout with ELK, and renders it using
 * custom node/edge components.
 *
 * @param sql - The SQL query string to visualize.
 * @param schema - Optional schema info for enriching table nodes with column types.
 * @param onError - Callback fired when parsing or layout fails.
 */
export function QueryFlowCanvas({
  sql,
  schema,
  onError,
}: {
  sql: string;
  schema?: SchemaTable[];
  onError?: (error: string) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateGraph = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setNodes([]);
        setEdges([]);
        return;
      }

      setIsProcessing(true);

      const result = sqlToFlowGraph(query, schema);

      if ("error" in result) {
        onError?.(result.error);
        setIsProcessing(false);
        return;
      }

      if (result.nodes.length === 0) {
        setNodes([]);
        setEdges([]);
        setIsProcessing(false);
        return;
      }

      try {
        const { nodes: rfNodes, edges: rfEdges } =
          await flowGraphToReactFlow(result);
        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Layout failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [schema, onError, setNodes, setEdges]
  );

  useEffect(() => {
    updateGraph(sql);
  }, [sql, updateGraph]);

  return (
    <div className="h-full w-full relative">
      {isProcessing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
          <span className="text-sm text-muted-foreground">Processing...</span>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap
          className="!bg-background !border"
          nodeColor="#6366f1"
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}
