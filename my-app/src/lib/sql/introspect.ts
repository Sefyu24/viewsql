import type { PGlite } from "@electric-sql/pglite";

export type SchemaTable = {
  name: string;
  columns: SchemaColumn[];
};

export type SchemaColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignTable?: string;
  foreignColumn?: string;
  defaultValue: string | null;
};

/**
 * Introspect the public schema of a PGlite database instance.
 *
 * Queries `information_schema` to extract all tables, their columns,
 * primary keys, and foreign key relationships.
 *
 * @param db - An initialized PGlite database instance with DDL already executed.
 * @returns An object containing:
 *   - `tables`: Array of `SchemaTable` objects with columns, PK/FK info, and types.
 *   - `error`: An error message string if introspection failed, otherwise undefined.
 */
export async function introspectSchema(
  db: PGlite
): Promise<{ tables: SchemaTable[]; error?: string }> {
  try {
    const tablesResult = await db.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: SchemaTable[] = [];

    for (const row of tablesResult.rows) {
      const columnsResult = await db.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>(
        `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `,
        [row.table_name]
      );

      const pkResult = await db.query<{ column_name: string }>(
        `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
      `,
        [row.table_name]
      );
      const pkColumns = new Set(pkResult.rows.map((r) => r.column_name));

      const fkResult = await db.query<{
        column_name: string;
        foreign_table: string;
        foreign_column: string;
      }>(
        `
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'FOREIGN KEY'
      `,
        [row.table_name]
      );
      const fkMap = new Map(
        fkResult.rows.map((r) => [
          r.column_name,
          { table: r.foreign_table, column: r.foreign_column },
        ])
      );

      tables.push({
        name: row.table_name,
        columns: columnsResult.rows.map((col) => ({
          name: col.column_name,
          dataType: col.data_type,
          nullable: col.is_nullable === "YES",
          isPrimaryKey: pkColumns.has(col.column_name),
          isForeignKey: fkMap.has(col.column_name),
          foreignTable: fkMap.get(col.column_name)?.table,
          foreignColumn: fkMap.get(col.column_name)?.column,
          defaultValue: col.column_default,
        })),
      });
    }

    return { tables };
  } catch (e) {
    return {
      tables: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
