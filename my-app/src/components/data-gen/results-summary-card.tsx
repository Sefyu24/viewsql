"use client";

import { CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DataGenResult } from "@/lib/data-gen/types";

export function ResultsSummaryCard({
  result,
  sampleData,
}: {
  result: DataGenResult;
  sampleData?: Map<string, Record<string, unknown>[]>;
}) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  };

  return (
    <Card className="mt-2 py-3 gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <CardHeader className="px-3 py-0 gap-1">
        <CardTitle className="text-xs flex items-center gap-1.5">
          {result.success ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          )}
          {result.success ? "Data Generated" : "Partial Results"}
          <Badge variant="secondary" className="text-[10px] font-normal ml-1">
            {result.totalRows.toLocaleString()} rows · {result.durationMs}ms
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3 py-0 space-y-1">
        {/* Successful tables */}
        {result.tablesInserted.map((t) => {
          const rows = sampleData?.get(t.tableName);
          const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

          return (
            <Collapsible
              key={t.tableName}
              open={expandedTables.has(t.tableName)}
              onOpenChange={() => toggleTable(t.tableName)}
            >
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 px-1 rounded hover:bg-accent/50 transition-colors text-xs group">
                <ChevronRight
                  className={`h-3 w-3 text-muted-foreground transition-transform ${
                    expandedTables.has(t.tableName) ? "rotate-90" : ""
                  }`}
                />
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="font-medium flex-1 text-left truncate">
                  {t.tableName}
                </span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {t.rowCount} rows
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {rows && rows.length > 0 && (
                  <div className="ml-6 mb-1 overflow-x-auto">
                    <table className="text-[10px] font-mono w-full">
                      <thead>
                        <tr className="border-b">
                          {columns.map((col) => (
                            <th
                              key={col}
                              className="text-left py-0.5 px-1 text-muted-foreground font-medium"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-b border-border/50">
                            {columns.map((col) => (
                              <td
                                key={col}
                                className="py-0.5 px-1 truncate max-w-[120px]"
                              >
                                {row[col] == null
                                  ? "NULL"
                                  : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Errors */}
        {result.errors.length > 0 && (
          <div className="rounded border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-2 space-y-0.5">
            {result.errors.map((e) => (
              <div key={e.tableName} className="text-[10px] text-red-700 dark:text-red-300">
                <span className="font-medium">{e.tableName}:</span> {e.error}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
