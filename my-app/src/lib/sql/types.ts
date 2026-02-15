// ── Flow Graph Types (used in Phase 3) ──

export type FlowNodeKind =
  | "table-source"
  | "cte"
  | "join"
  | "filter"
  | "aggregation"
  | "output";

export type ColumnRef = {
  name: string;
  sourceTable?: string;
  sourceColumn?: string;
  dataType?: string;
};

export type TableSourceData = {
  kind: "table-source";
  tableName: string;
  alias?: string;
  columns: ColumnRef[];
  /** Index into the color palette — assigned during graph building */
  colorIndex?: number;
};

export type CTEData = {
  kind: "cte";
  cteName: string;
  outputColumns: ColumnRef[];
  hasWhere: boolean;
  hasGroupBy: boolean;
};

export type JoinData = {
  kind: "join";
  joinType: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";
  condition: string;
};

export type FilterData = {
  kind: "filter";
  condition: string;
};

export type AggregationData = {
  kind: "aggregation";
  groupByColumns: string[];
  aggregates: string[];
};

export type OutputData = {
  kind: "output";
  columns: ColumnRef[];
  orderBy?: string;
  limit?: number;
  /** Maps table name (or alias) → color palette index for column highlighting */
  tableColorMap?: Record<string, number>;
};

export type FlowNodeData =
  | TableSourceData
  | CTEData
  | JoinData
  | FilterData
  | AggregationData
  | OutputData;

export type FlowNode = {
  id: string;
  data: FlowNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  columns?: string[];
  label?: string;
  animated?: boolean;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};
