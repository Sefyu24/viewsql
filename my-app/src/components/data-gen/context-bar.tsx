"use client";

import { Database } from "lucide-react";
import type { SchemaTable } from "@/lib/sql/introspect";

export function ContextBar({
  schema,
  pgliteStatus,
  totalRowsGenerated,
}: {
  schema: SchemaTable[];
  pgliteStatus: "loading" | "active" | "error";
  totalRowsGenerated: number;
}) {
  const statusColor =
    pgliteStatus === "active"
      ? "bg-emerald-500"
      : pgliteStatus === "loading"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-3 border-b px-4 py-1.5 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Database className="h-3 w-3" />
        {schema.length} table{schema.length !== 1 ? "s" : ""}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
        {pgliteStatus === "active"
          ? "Active"
          : pgliteStatus === "loading"
            ? "Loading"
            : "Error"}
      </span>
      {totalRowsGenerated > 0 && (
        <span>{totalRowsGenerated.toLocaleString()} rows</span>
      )}
    </div>
  );
}
