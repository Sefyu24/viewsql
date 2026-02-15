import { astVisitor, toSql, type Expr, type ExprCall } from "pgsql-ast-parser";

const AGGREGATE_FUNCTIONS = new Set([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "array_agg",
  "string_agg",
  "bool_and",
  "bool_or",
  "json_agg",
  "jsonb_agg",
]);

/**
 * Convert an AST expression node back to a SQL string.
 *
 * Uses pgsql-ast-parser's built-in `toSql` — no custom stringification needed.
 *
 * @param expr - An AST expression node from pgsql-ast-parser.
 * @returns A SQL string representation of the expression.
 */
export function exprToSql(expr: Expr): string {
  try {
    return toSql.expr(expr);
  } catch {
    return "(expr)";
  }
}

/**
 * Extract all column references from an expression tree using astVisitor.
 *
 * Walks the AST and collects every `ref` node, returning them as
 * `{ table?, column }` pairs. Used to determine which columns flow
 * between nodes in the flow graph.
 *
 * @param expr - An AST expression node.
 * @returns Array of column references found in the expression.
 */
export function extractColumnRefs(
  expr: Expr
): { table?: string; column: string }[] {
  const refs: { table?: string; column: string }[] = [];
  const visitor = astVisitor(() => ({
    ref: (node) => {
      refs.push({
        table: node.table?.name,
        column: node.name === "*" ? "*" : node.name,
      });
    },
  }));
  visitor.expr(expr);
  return refs;
}

/**
 * Check whether an expression contains any aggregate function calls
 * (COUNT, SUM, AVG, MIN, MAX, etc.).
 *
 * @param expr - An AST expression node.
 * @returns True if the expression contains at least one aggregate function.
 */
export function containsAggregate(expr: Expr): boolean {
  let found = false;
  const visitor = astVisitor(() => ({
    call: (node) => {
      if (AGGREGATE_FUNCTIONS.has(node.function?.name?.toLowerCase() ?? "")) {
        found = true;
      }
    },
  }));
  visitor.expr(expr);
  return found;
}

/**
 * Extract aggregate function calls from an expression, returning them
 * as human-readable SQL strings like "COUNT(id)" or "SUM(amount)".
 *
 * @param expr - An AST expression node.
 * @returns Array of stringified aggregate function calls found in the expression.
 */
export function extractAggregates(expr: Expr): string[] {
  const aggs: string[] = [];
  const visitor = astVisitor(() => ({
    call: (node: ExprCall) => {
      if (AGGREGATE_FUNCTIONS.has(node.function?.name?.toLowerCase() ?? "")) {
        aggs.push(exprToSql(node));
      }
    },
  }));
  visitor.expr(expr);
  return aggs;
}
