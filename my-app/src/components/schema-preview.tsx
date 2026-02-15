"use client";

import type { SchemaTable } from "@/lib/sql/introspect";

/**
 * Renders a list of tables and their columns extracted from PGlite introspection.
 *
 * Shows table names with column details including data type,
 * nullable status, and PK/FK badges.
 *
 * @param tables - Array of SchemaTable objects from introspectSchema().
 */
export function SchemaPreview({ tables }: { tables: SchemaTable[] }) {
  if (tables.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tables found.</p>
    );
  }

  return (
    <div className="space-y-3">
      {tables.map((table) => (
        <div key={table.name} className="rounded-md border p-3">
          <h4 className="text-sm font-semibold">{table.name}</h4>
          <div className="mt-2 space-y-1">
            {table.columns.map((col) => (
              <div
                key={col.name}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="font-medium text-foreground">{col.name}</span>
                <span>{col.dataType}</span>
                {col.isPrimaryKey && (
                  <span className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    PK
                  </span>
                )}
                {col.isForeignKey && (
                  <span
                    className="rounded bg-blue-100 px-1 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    title={`→ ${col.foreignTable}.${col.foreignColumn}`}
                  >
                    FK
                  </span>
                )}
                {col.nullable && (
                  <span className="text-muted-foreground/60">nullable</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
