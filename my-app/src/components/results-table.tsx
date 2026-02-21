"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

/**
 * Displays SQL query execution results in a table, or an error message.
 *
 * Shows column headers and row data from PGlite query output.
 * Handles empty results and error states.
 *
 * @param result - The query result with columns and rows.
 * @param error - An error message string if the query failed.
 */
export function ResultsTable({
  result,
  error,
}: {
  result?: QueryResult | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200 font-mono">
          {error}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Run a query to see results (Cmd+Enter)
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Query returned no rows.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            {result.columns.map((col, colIdx) => (
              <TableHead key={colIdx} className="text-xs font-semibold">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row, i) => (
            <TableRow key={i}>
              {result.columns.map((col, colIdx) => (
                <TableCell key={colIdx} className="text-xs font-mono">
                  {row[col] === null ? (
                    <span className="text-muted-foreground/50">NULL</span>
                  ) : (
                    String(row[col])
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
