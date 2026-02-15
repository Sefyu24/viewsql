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
  /** Maps table name → color palette index */
  private tableColorMap = new Map<string, number>();
  private tableColorCounter = 0;
  /** Column references found in the current SELECT being processed */
  private currentRefs = new Map<string, Set<string>>();
  /** Whether the current SELECT uses an unqualified SELECT * */
  private currentShowAll = false;
  /** When processing a CTE, the ID of its group node (null otherwise) */
  private currentCteGroupId: string | null = null;

  constructor(schema?: SchemaTable[]) {
    this.schemaMap = new Map(
      (schema ?? []).map((t) => [t.name, t])
    );
  }

  private nextId(prefix: string): string {
    return `${prefix}_${this.nodeCounter++}`;
  }

  private addNode(node: FlowNode): string {
    if (this.currentCteGroupId && node.data.kind !== "cte-group") {
      node.parentCteId = this.currentCteGroupId;
    }
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
   * Collect all column references from a SELECT statement.
   *
   * Walks the SELECT list, JOIN ON conditions, WHERE, GROUP BY,
   * and ORDER BY to determine which columns are actually used.
   * Sets `currentRefs` and `currentShowAll` for use by `filterColumns`.
   *
   * @param select - The SELECT statement AST node to analyze.
   */
  private collectReferencedColumns(select: SelectFromStatement): void {
    this.currentRefs = new Map();
    this.currentShowAll = false;

    const allRefs: { table?: string; column: string }[] = [];

    // SELECT columns
    for (const col of select.columns ?? []) {
      if (col.expr) {
        if (col.expr.type === "ref" && col.expr.name === "*" && !col.expr.table) {
          this.currentShowAll = true;
          return;
        }
        allRefs.push(...extractColumnRefs(col.expr));
      }
    }

    // JOIN ON conditions
    for (const item of select.from ?? []) {
      if (item.type === "table") {
        const tableFrom = item as FromTable;
        if (tableFrom.join?.on) {
          allRefs.push(...extractColumnRefs(tableFrom.join.on));
        }
      }
    }

    // WHERE
    if (select.where) {
      allRefs.push(...extractColumnRefs(select.where));
    }

    // GROUP BY
    for (const g of (select.groupBy ?? []) as Expr[]) {
      allRefs.push(...extractColumnRefs(g));
    }

    // ORDER BY
    for (const o of select.orderBy ?? []) {
      allRefs.push(...extractColumnRefs(o.by));
    }

    // Build lookup map: table/alias → Set of column names
    for (const ref of allRefs) {
      if (ref.column === "*") {
        if (ref.table) {
          this.currentRefs.set(ref.table, new Set(["*"]));
        } else {
          this.currentShowAll = true;
          return;
        }
        continue;
      }
      const key = ref.table ?? "__unqualified__";
      const existing = this.currentRefs.get(key) ?? new Set();
      existing.add(ref.column);
      this.currentRefs.set(key, existing);
    }
  }

  /**
   * Filter schema columns to only those referenced in the current query.
   *
   * If the query uses SELECT *, all columns are returned.
   * If a specific table uses t.*, all columns for that table are returned.
   * Unqualified column references (no table prefix) match against any table
   * that has a column with that name.
   *
   * @param columns - Full list of columns from the schema.
   * @param tableName - The table's actual name.
   * @param alias - The table's alias in the query, if any.
   * @returns Filtered list of columns actually used in the query.
   */
  private filterColumns(
    columns: ColumnRef[],
    tableName: string,
    alias?: string
  ): ColumnRef[] {
    if (this.currentShowAll) return columns;

    const byAlias = alias ? this.currentRefs.get(alias) : undefined;
    const byName = this.currentRefs.get(tableName);
    const unqualified = this.currentRefs.get("__unqualified__");

    // t.* or tableName.* — show all columns
    if (byAlias?.has("*") || byName?.has("*")) return columns;

    return columns.filter((col) => {
      if (byAlias?.has(col.name)) return true;
      if (byName?.has(col.name)) return true;
      if (unqualified?.has(col.name)) return true;
      return false;
    });
  }

  /**
   * Process a CTE definition and register it for later reference.
   *
   * Creates a group container node, then processes the CTE's inner SELECT
   * so all inner nodes are tagged with `parentCteId`. Finally creates the
   * CTE result node inside the group.
   */
  processCTE(name: string, select: SelectFromStatement): void {
    const colorIndex = this.tableColorCounter++;
    this.tableColorMap.set(name, colorIndex);

    // 1. Create the group container node
    const groupId = this.nextId("cte_group");
    this.addNode({
      id: groupId,
      data: {
        kind: "cte-group",
        cteName: name,
        colorIndex,
      },
    });

    // 2. Process inner SELECT with group tagging active
    this.currentCteGroupId = groupId;
    const innerLastNodeId = this.processSelectInner(select);

    // 3. Create the CTE result node (also inside the group)
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
        colorIndex,
      },
    });

    if (innerLastNodeId) {
      this.addEdge(innerLastNodeId, cteId, { animated: true });
    }

    // 4. Reset group tagging
    this.currentCteGroupId = null;

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

    // Build color map for the output node: table name → color index
    const tableColorMap: Record<string, number> = {};
    for (const [name, index] of this.tableColorMap) {
      tableColorMap[name] = index;
    }

    this.addNode({
      id: outputId,
      data: {
        kind: "output",
        columns: outputCols,
        orderBy,
        limit,
        tableColorMap,
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
    // Pre-collect all column references so table nodes only show used columns
    this.collectReferencedColumns(select);

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
        if (alias) {
          this.aliasRegistry.set(alias, currentNodeId);
          // Register alias in color map so Result columns using the alias get colored
          const cteColor = this.tableColorMap.get(tableName);
          if (cteColor !== undefined) this.tableColorMap.set(alias, cteColor);
        }
      } else {
        // Regular table source — assign a unique color
        const tableId = this.nextId("table");
        const columns = this.filterColumns(
          this.getSchemaColumns(tableName),
          tableName,
          alias
        );
        const colorIndex = this.tableColorCounter++;
        this.tableColorMap.set(tableName, colorIndex);
        if (alias) this.tableColorMap.set(alias, colorIndex);

        this.addNode({
          id: tableId,
          data: {
            kind: "table-source",
            tableName,
            alias,
            columns,
            colorIndex,
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
