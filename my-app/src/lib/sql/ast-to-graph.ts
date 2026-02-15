import {
  parseFirst,
  type SelectFromStatement,
  type SelectStatement,
  type From,
  type FromTable,
  type JoinClause,
  type Expr,
  type WithStatement,
} from "pgsql-ast-parser";
import type {
  FlowGraph,
  FlowNode,
  ColumnRef,
} from "./types";
import {
  exprToSql,
  extractColumnRefs,
  extractAggregates,
} from "./expr-utils";
import type { SchemaTable } from "./introspect";

/**
 * Convert a SQL query string into a FlowGraph for visualization.
 *
 * Parses the SQL using pgsql-ast-parser, then walks the AST to produce
 * a graph of nodes (tables, joins, filters, aggregations, CTEs, output)
 * connected by edges showing data flow.
 *
 * @param sql - A SQL SELECT query string (may include CTEs).
 * @param schema - Optional array of SchemaTable objects from PGlite introspection,
 *                 used to enrich table-source nodes with column type info.
 * @returns A FlowGraph with nodes and edges, or an object with an error string.
 */
export function sqlToFlowGraph(
  sql: string,
  schema?: SchemaTable[]
): FlowGraph | { error: string } {
  try {
    const ast = parseFirst(sql);

    const builder = new FlowGraphBuilder(schema);

    if (ast.type === "with") {
      const withStmt = ast as WithStatement;
      for (const cte of withStmt.bind ?? []) {
        if (cte.statement.type === "select") {
          builder.processCTE(cte.alias.name, cte.statement);
        }
      }
      if (withStmt.in.type === "select") {
        builder.processSelect(withStmt.in);
      }
    } else if (ast.type === "select") {
      builder.processSelect(ast as SelectFromStatement);
    } else {
      return { error: "Only SELECT queries can be visualized." };
    }

    return builder.build();
  } catch (e) {
    return {
      error: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Internal builder that accumulates nodes and edges as it walks a SELECT AST.
 *
 * The processing order mirrors SQL execution:
 * 1. CTEs (WITH clauses) processed first, registered for later reference
 * 2. FROM clause: table-source nodes
 * 3. JOINs: join nodes connecting table sources
 * 4. WHERE: filter node
 * 5. GROUP BY: aggregation node
 * 6. SELECT columns: output node with column lineage
 */
class FlowGraphBuilder {
  private nodes: FlowNode[] = [];
  private edges: { id: string; source: string; target: string; columns?: string[]; label?: string; animated?: boolean }[] = [];
  private nodeCounter = 0;
  private schemaMap: Map<string, SchemaTable>;
  /** Maps CTE names to their output node ID */
  private cteRegistry = new Map<string, string>();
  /** Maps table aliases to their node IDs */
  private aliasRegistry = new Map<string, string>();

  constructor(schema?: SchemaTable[]) {
    this.schemaMap = new Map(
      (schema ?? []).map((t) => [t.name, t])
    );
  }

  private nextId(prefix: string): string {
    return `${prefix}_${this.nodeCounter++}`;
  }

  private addNode(node: FlowNode): string {
    this.nodes.push(node);
    return node.id;
  }

  private addEdge(
    source: string,
    target: string,
    options?: { columns?: string[]; label?: string; animated?: boolean }
  ): void {
    this.edges.push({
      id: `e_${source}_${target}`,
      source,
      target,
      ...options,
    });
  }

  /**
   * Look up column info from the introspected schema for a given table.
   */
  private getSchemaColumns(tableName: string): ColumnRef[] {
    const table = this.schemaMap.get(tableName);
    if (!table) return [];
    return table.columns.map((col) => ({
      name: col.name,
      sourceTable: tableName,
      sourceColumn: col.name,
      dataType: col.dataType,
    }));
  }

  /**
   * Process a CTE definition and register it for later reference.
   */
  processCTE(name: string, select: SelectFromStatement): void {
    const innerLastNodeId = this.processSelectInner(select);

    const cteId = this.nextId("cte");
    const outputCols = this.resolveSelectColumns(select);

    this.addNode({
      id: cteId,
      data: {
        kind: "cte",
        cteName: name,
        outputColumns: outputCols,
        hasWhere: !!select.where,
        hasGroupBy: !!(select.groupBy && select.groupBy.length > 0),
      },
    });

    if (innerLastNodeId) {
      this.addEdge(innerLastNodeId, cteId, { animated: true });
    }

    this.cteRegistry.set(name, cteId);
  }

  /**
   * Process the main SELECT statement and add an output node.
   */
  processSelect(select: SelectFromStatement): void {
    const lastNodeId = this.processSelectInner(select);

    const outputId = this.nextId("output");
    const outputCols = this.resolveSelectColumns(select);

    const orderBy = select.orderBy
      ? select.orderBy.map((o) => exprToSql(o.by)).join(", ")
      : undefined;

    const limit =
      select.limit?.limit?.type === "integer"
        ? (select.limit.limit as { value: number }).value
        : undefined;

    this.addNode({
      id: outputId,
      data: {
        kind: "output",
        columns: outputCols,
        orderBy,
        limit,
      },
    });

    if (lastNodeId) {
      this.addEdge(lastNodeId, outputId, {
        animated: true,
        columns: outputCols.map((c) => c.name),
      });
    }
  }

  /**
   * Process the inner parts of a SELECT (FROM, JOINs, WHERE, GROUP BY)
   * and return the ID of the last node in the chain.
   */
  private processSelectInner(select: SelectFromStatement): string | null {
    let lastNodeId: string | null = null;

    // 1. Process FROM clause (tables + joins)
    if (select.from && select.from.length > 0) {
      lastNodeId = this.processFrom(select.from);
    }

    // 2. WHERE → filter node
    if (select.where) {
      const filterId = this.nextId("filter");
      this.addNode({
        id: filterId,
        data: {
          kind: "filter",
          condition: exprToSql(select.where),
        },
      });
      if (lastNodeId) {
        this.addEdge(lastNodeId, filterId, { animated: true });
      }
      lastNodeId = filterId;
    }

    // 3. GROUP BY → aggregation node
    if (select.groupBy && select.groupBy.length > 0) {
      // groupBy items are Expr[] directly
      const groupCols = select.groupBy.map((g: Expr) => exprToSql(g));

      const allAggregates: string[] = [];
      for (const col of select.columns ?? []) {
        if (col.expr) {
          allAggregates.push(...extractAggregates(col.expr));
        }
      }

      const aggId = this.nextId("agg");
      this.addNode({
        id: aggId,
        data: {
          kind: "aggregation",
          groupByColumns: groupCols,
          aggregates: [...new Set(allAggregates)],
        },
      });
      if (lastNodeId) {
        this.addEdge(lastNodeId, aggId, { animated: true });
      }
      lastNodeId = aggId;
    }

    return lastNodeId;
  }

  /**
   * Process FROM clause items (tables and joins).
   *
   * In pgsql-ast-parser, JOINed tables appear as separate FROM entries
   * with a `join` property containing the join type and ON condition.
   * The first FROM entry is the left table (no join property), and
   * subsequent entries have `join` set.
   */
  private processFrom(fromItems: From[]): string | null {
    let lastNodeId: string | null = null;

    for (const item of fromItems) {
      if (item.type !== "table") continue;

      const tableFrom = item as FromTable;
      const tableName = tableFrom.name?.name ?? "";
      const alias = tableFrom.name?.alias;

      let currentNodeId: string;

      // Check if this is a CTE reference
      if (this.cteRegistry.has(tableName)) {
        currentNodeId = this.cteRegistry.get(tableName)!;
        if (alias) this.aliasRegistry.set(alias, currentNodeId);
      } else {
        // Regular table source
        const tableId = this.nextId("table");
        const columns = this.getSchemaColumns(tableName);

        this.addNode({
          id: tableId,
          data: {
            kind: "table-source",
            tableName,
            alias,
            columns,
          },
        });

        this.aliasRegistry.set(alias ?? tableName, tableId);
        currentNodeId = tableId;
      }

      // If this FROM entry has a join, create a join node connecting
      // the previous table (leftNodeId) with this one
      if (tableFrom.join && lastNodeId) {
        const joinId = this.nextId("join");
        const joinType = (tableFrom.join.type ?? "INNER JOIN")
          .replace(" JOIN", "")
          .trim();

        const condition = tableFrom.join.on
          ? exprToSql(tableFrom.join.on)
          : "";
        const conditionRefs = tableFrom.join.on
          ? extractColumnRefs(tableFrom.join.on).map((r) => r.column)
          : [];

        this.addNode({
          id: joinId,
          data: {
            kind: "join",
            joinType: joinType as "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS",
            condition,
          },
        });

        this.addEdge(lastNodeId, joinId, {
          animated: true,
          columns: conditionRefs,
        });
        this.addEdge(currentNodeId, joinId, {
          animated: true,
          columns: conditionRefs,
        });

        lastNodeId = joinId;
      } else {
        lastNodeId = currentNodeId;
      }
    }

    return lastNodeId;
  }

  /**
   * Resolve SELECT column expressions into ColumnRef objects
   * for the output node.
   */
  private resolveSelectColumns(select: SelectFromStatement): ColumnRef[] {
    const columns: ColumnRef[] = [];

    for (const col of select.columns ?? []) {
      if (col.expr?.type === "ref") {
        const ref = col.expr;
        const name = col.alias?.name ?? ref.name;
        columns.push({
          name: name === "*" ? "*" : name,
          sourceTable: ref.table?.name,
          sourceColumn: ref.name === "*" ? undefined : ref.name,
        });
      } else if (col.expr) {
        const name = col.alias?.name ?? exprToSql(col.expr);
        const refs = extractColumnRefs(col.expr);
        columns.push({
          name,
          sourceTable: refs[0]?.table,
          sourceColumn: refs[0]?.column,
        });
      }
    }

    return columns;
  }

  /**
   * Return the final FlowGraph.
   */
  build(): FlowGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }
}
