import type { PGlite } from "@electric-sql/pglite";
import type { SchemaTable, SchemaColumn } from "@/lib/sql/introspect";
import type {
  DataGenConfig,
  DataGenResult,
  TableGenConfig,
  ColumnGenConfig,
  ExecutionProgress,
  TableProgress,
} from "./types";

/**
 * Topologically sort tables so parents (FK targets) come before children.
 * Uses DFS-based toposort on the FK dependency graph derived from both
 * the schema FK definitions and the AI-generated foreignKey generators.
 */
function topologicalSort(
  tables: TableGenConfig[],
  schema: SchemaTable[]
): TableGenConfig[] {
  const tableNames = new Set(tables.map((t) => t.tableName));
  const schemaMap = new Map(schema.map((t) => [t.name, t]));

  // Build adjacency: child → parents
  const deps = new Map<string, Set<string>>();
  for (const name of tableNames) {
    deps.set(name, new Set());
  }

  // 1. Schema-level FK relationships
  for (const name of tableNames) {
    const st = schemaMap.get(name);
    if (!st) continue;
    for (const col of st.columns) {
      if (col.isForeignKey && col.foreignTable && tableNames.has(col.foreignTable)) {
        if (col.foreignTable !== name) {
          deps.get(name)!.add(col.foreignTable);
        }
      }
    }
  }

  // 2. Config-level foreignKey generators (AI may reference tables the schema doesn't FK to)
  for (const table of tables) {
    for (const col of table.columns) {
      if (
        col.generator.type === "foreignKey" &&
        col.generator.table &&
        tableNames.has(col.generator.table) &&
        col.generator.table !== table.tableName
      ) {
        deps.get(table.tableName)!.add(col.generator.table);
      }
    }
  }

  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Circular FK dependency detected involving table "${name}"`);
    }
    visiting.add(name);
    for (const dep of deps.get(name) ?? []) {
      visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }

  for (const name of tableNames) {
    visit(name);
  }

  const orderMap = new Map(sorted.map((name, i) => [name, i]));
  return [...tables].sort(
    (a, b) => (orderMap.get(a.tableName) ?? 0) - (orderMap.get(b.tableName) ?? 0)
  );
}

/**
 * Resolve a dot-path faker method like "person.firstName" to the actual function
 * and call it. Property access only — no eval.
 */
function resolveFakerMethod(
  faker: Record<string, unknown>,
  method: string,
  params?: Record<string, unknown>
): unknown {
  const parts = method.split(".");
  let current: unknown = faker;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      throw new Error(`Invalid faker method: "${method}" — "${part}" is not accessible`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current !== "function") {
    throw new Error(`Invalid faker method: "${method}" — not a function`);
  }

  return params && Object.keys(params).length > 0 ? current(params) : current();
}

/**
 * Coerce a faker-generated value to match the PostgreSQL column type.
 */
function coerceToPostgresType(value: unknown, pgType: string): unknown {
  if (value === null || value === undefined) return null;

  const t = pgType.toLowerCase();

  if (t.includes("int") || t === "smallint" || t === "bigint") {
    return Math.floor(Number(value));
  }
  if (t === "numeric" || t === "decimal" || t === "real" || t.includes("double") || t.includes("float")) {
    return Number(value);
  }
  if (t === "boolean") {
    return Boolean(value);
  }
  if (t.includes("timestamp") || t === "date") {
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  if (t === "jsonb" || t === "json") {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Escape a value for use in a SQL INSERT statement.
 */
function escapeSqlValue(value: unknown, pgType: string): string {
  if (value === null || value === undefined) return "NULL";

  const t = pgType.toLowerCase();

  if (t === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (t.includes("int") || t === "smallint" || t === "bigint" ||
      t === "numeric" || t === "decimal" || t === "real" ||
      t.includes("double") || t.includes("float")) {
    const n = Number(value);
    if (Number.isNaN(n)) return "NULL";
    return String(n);
  }
  if (t === "jsonb" || t === "json") {
    const jsonStr = typeof value === "string" ? value : JSON.stringify(value);
    return `'${jsonStr.replace(/'/g, "''")}'`;
  }

  // Default: treat as string
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Generate rows for a single table based on its config.
 */
async function generateRows(
  tableConfig: TableGenConfig,
  generatedPKs: Map<string, unknown[]>,
  schemaTable: SchemaTable,
  fakerModule: { faker: Record<string, unknown> }
): Promise<Record<string, unknown>[]> {
  const { faker } = fakerModule;
  const rows: Record<string, unknown>[] = [];
  const colTypeMap = new Map(schemaTable.columns.map((c) => [c.name, c.dataType]));

  // For self-referencing FKs: track PKs generated so far within this table.
  // Detect which column is the PK and whether any column has a self-ref FK.
  const pkCol = schemaTable.columns.find((c) => c.isPrimaryKey);
  const hasSelfRef = tableConfig.columns.some(
    (c) => c.generator.type === "foreignKey" && c.generator.table === tableConfig.tableName
  );
  const selfRefPKs: unknown[] = [];

  for (let i = 0; i < tableConfig.rowCount; i++) {
    const row: Record<string, unknown> = {};

    for (const colConfig of tableConfig.columns) {
      const pgType = colTypeMap.get(colConfig.columnName) ?? "text";
      let value: unknown = null;

      // Check nullProbability first
      if (
        colConfig.nullProbability != null &&
        colConfig.nullProbability > 0 &&
        Math.random() < colConfig.nullProbability
      ) {
        row[colConfig.columnName] = null;
        continue;
      }

      const gen = colConfig.generator;

      switch (gen.type) {
        case "faker":
          value = resolveFakerMethod(faker, gen.method, gen.params);
          value = coerceToPostgresType(value, pgType);
          break;

        case "foreignKey": {
          const isSelfRef = gen.table === tableConfig.tableName;
          const parentRows = generatedPKs.get(gen.table);

          if (isSelfRef) {
            // Self-referencing FK: use NULL for ~30% of rows (including the first),
            // and pick from already-generated PKs in the current batch for the rest.
            if (i === 0 || !selfRefPKs.length || Math.random() < 0.3) {
              value = null;
            } else {
              value = selfRefPKs[Math.floor(Math.random() * selfRefPKs.length)];
            }
          } else if (!parentRows || parentRows.length === 0) {
            throw new Error(
              `FK reference failed: table "${gen.table}" has no rows. ` +
              `Ensure parent tables are populated before children.`
            );
          } else {
            value = parentRows[Math.floor(Math.random() * parentRows.length)];
          }
          break;
        }

        case "sequence":
          value = (gen.start ?? 1) + (gen.step ?? 1) * i;
          break;

        case "oneOf":
          value = gen.values[Math.floor(Math.random() * gen.values.length)];
          value = coerceToPostgresType(value, pgType);
          break;

        case "weightedOneOf": {
          const totalWeight = gen.options.reduce((sum, o) => sum + o.weight, 0);
          let roll = Math.random() * totalWeight;
          for (const opt of gen.options) {
            roll -= opt.weight;
            if (roll <= 0) {
              value = opt.value;
              break;
            }
          }
          value = coerceToPostgresType(value, pgType);
          break;
        }

        case "null":
          value = null;
          break;
      }

      row[colConfig.columnName] = value;
    }

    rows.push(row);

    // Track PK values for self-referencing FK resolution within this batch
    if (hasSelfRef && pkCol) {
      const pkValue = row[pkCol.name];
      if (pkValue != null) {
        selfRefPKs.push(pkValue);
      }
    }
  }

  return rows;
}

/**
 * Build batched INSERT SQL for a table's rows.
 */
function buildInsertSQL(
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  schemaTable: SchemaTable
): string[] {
  if (rows.length === 0 || columns.length === 0) return [];

  const colTypeMap = new Map(schemaTable.columns.map((c) => [c.name, c.dataType]));
  const quotedCols = columns.map((c) => `"${c}"`).join(", ");
  const statements: string[] = [];
  const BATCH_SIZE = 500;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const valueRows = batch.map((row) => {
      const vals = columns.map((col) =>
        escapeSqlValue(row[col], colTypeMap.get(col) ?? "text")
      );
      return `  (${vals.join(", ")})`;
    });

    statements.push(
      `INSERT INTO "${tableName}" (${quotedCols}) VALUES\n${valueRows.join(",\n")};`
    );
  }

  return statements;
}

/**
 * Execute a DataGenConfig: generate rows with faker.js and insert into PGlite.
 */
export async function executeDataGen(
  config: DataGenConfig,
  db: PGlite,
  schema: SchemaTable[],
  seed?: number,
  onProgress?: (progress: ExecutionProgress) => void
): Promise<DataGenResult> {
  const startTime = performance.now();
  const tablesInserted: { tableName: string; rowCount: number }[] = [];
  const errors: { tableName: string; error: string }[] = [];
  const schemaMap = new Map(schema.map((t) => [t.name, t]));

  // Dynamically import faker to keep it out of the initial bundle
  const fakerModule = await import("@faker-js/faker");
  if (seed != null) {
    (fakerModule.faker as unknown as { seed: (s: number) => void }).seed(seed);
  }

  // Sort tables by FK dependencies
  let sortedTables: TableGenConfig[];
  try {
    sortedTables = topologicalSort(config.tables, schema);
  } catch (e) {
    return {
      success: false,
      tablesInserted: [],
      errors: [{ tableName: "(all)", error: e instanceof Error ? e.message : String(e) }],
      totalRows: 0,
      durationMs: performance.now() - startTime,
    };
  }

  // Initialize progress tracking
  const tableProgressList: TableProgress[] = sortedTables.map((t) => ({
    tableName: t.tableName,
    status: "pending" as const,
    rowCount: t.rowCount,
  }));

  function emitProgress(currentTable: string | null) {
    onProgress?.({ tables: [...tableProgressList], currentTable });
  }

  emitProgress(null);

  // Track generated PK values for FK resolution
  const generatedPKs = new Map<string, unknown[]>();

  for (let i = 0; i < sortedTables.length; i++) {
    const tableConfig = sortedTables[i];
    const progress = tableProgressList[i];
    const tableStart = performance.now();

    const schemaTable = schemaMap.get(tableConfig.tableName);
    if (!schemaTable) {
      progress.status = "error";
      progress.error = `Table "${tableConfig.tableName}" not found in schema`;
      errors.push({ tableName: tableConfig.tableName, error: progress.error });
      emitProgress(null);
      continue;
    }

    try {
      // Generate rows
      progress.status = "generating";
      emitProgress(tableConfig.tableName);

      const rows = await generateRows(
        tableConfig,
        generatedPKs,
        schemaTable,
        fakerModule as unknown as { faker: Record<string, unknown> }
      );

      if (rows.length === 0) {
        progress.status = "done";
        progress.elapsedMs = Math.round(performance.now() - tableStart);
        emitProgress(null);
        continue;
      }

      // Build and execute INSERT SQL
      progress.status = "inserting";
      emitProgress(tableConfig.tableName);

      const columns = tableConfig.columns.map((c) => c.columnName);
      const statements = buildInsertSQL(
        tableConfig.tableName,
        columns,
        rows,
        schemaTable
      );

      for (const sql of statements) {
        await db.exec(sql);
      }

      // Query back PK values for FK resolution by child tables
      const pkCol = schemaTable.columns.find((c) => c.isPrimaryKey);
      if (pkCol) {
        const pkResult = await db.query<Record<string, unknown>>(
          `SELECT "${pkCol.name}" FROM "${tableConfig.tableName}"`
        );
        generatedPKs.set(
          tableConfig.tableName,
          pkResult.rows.map((r) => r[pkCol.name])
        );
      }

      progress.status = "done";
      progress.elapsedMs = Math.round(performance.now() - tableStart);

      tablesInserted.push({
        tableName: tableConfig.tableName,
        rowCount: rows.length,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      progress.status = "error";
      progress.error = errorMsg;
      progress.elapsedMs = Math.round(performance.now() - tableStart);
      errors.push({ tableName: tableConfig.tableName, error: errorMsg });
    }

    emitProgress(null);
  }

  const totalRows = tablesInserted.reduce((sum, t) => sum + t.rowCount, 0);

  return {
    success: errors.length === 0,
    tablesInserted,
    errors,
    totalRows,
    durationMs: Math.round(performance.now() - startTime),
  };
}
