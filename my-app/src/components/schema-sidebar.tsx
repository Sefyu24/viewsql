"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { SchemaTable } from "@/lib/sql/introspect";

/**
 * Sidebar displaying the database schema as an expandable table/column tree.
 *
 * Each table can be clicked to expand and show its columns with
 * data type, PK/FK badges, and nullable status.
 *
 * @param tables - Array of SchemaTable objects from PGlite introspection.
 * @param isLoading - Whether the schema is still loading.
 */
export function SchemaSidebar({
  tables,
  isLoading,
}: {
  tables: SchemaTable[];
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleTable = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading schema...
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No tables found.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Tables
        </h3>
        {tables.map((table) => (
          <div key={table.name}>
            <button
              onClick={() => toggleTable(table.name)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm font-medium hover:bg-accent text-left"
            >
              <span className="text-xs text-muted-foreground">
                {expanded.has(table.name) ? "▼" : "▶"}
              </span>
              {table.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {table.columns.length}
              </span>
            </button>

            {expanded.has(table.name) && (
              <div className="ml-5 space-y-0.5 pb-1">
                {table.columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-1.5 px-2 py-0.5 text-xs"
                  >
                    <span className="font-medium truncate">{col.name}</span>
                    <span className="text-muted-foreground truncate">
                      {col.dataType}
                    </span>
                    {col.isPrimaryKey && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      >
                        PK
                      </Badge>
                    )}
                    {col.isForeignKey && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        title={`→ ${col.foreignTable}.${col.foreignColumn}`}
                      >
                        FK
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
