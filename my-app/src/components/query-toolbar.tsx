"use client";

import { Button } from "@/components/ui/button";

/**
 * Toolbar for the SQL editor with Run and Clear actions.
 *
 * @param onRun - Callback fired when the Run button is clicked.
 * @param onClear - Callback fired when the Clear button is clicked.
 * @param isRunning - Whether a query is currently executing (disables the Run button).
 */
export function QueryToolbar({
  onRun,
  onClear,
  isRunning,
}: {
  onRun: () => void;
  onClear: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5">
      <Button size="sm" onClick={onRun} disabled={isRunning}>
        {isRunning ? "Running..." : "Run"}
      </Button>
      <Button size="sm" variant="outline" onClick={onClear}>
        Clear
      </Button>
      <span className="ml-auto text-xs text-muted-foreground">
        Cmd+Enter to run
      </span>
    </div>
  );
}
