"use client";

import { Circle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ExecutionProgress } from "@/lib/data-gen/types";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "generating":
    case "inserting":
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
  }
}

export function ExecutionProgressView({
  progress,
}: {
  progress: ExecutionProgress;
}) {
  const completed = progress.tables.filter(
    (t) => t.status === "done" || t.status === "error"
  ).length;
  const total = progress.tables.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
        Generating data...
      </p>
      <div className="space-y-1">
        {progress.tables.map((t) => (
          <div
            key={t.tableName}
            className="flex items-center gap-2 text-xs"
          >
            <StatusIcon status={t.status} />
            <span className="font-medium flex-1 truncate">{t.tableName}</span>
            <span className="text-muted-foreground tabular-nums">
              {t.rowCount} rows
            </span>
            {t.elapsedMs != null && (
              <span className="text-muted-foreground/60 tabular-nums text-[10px] w-12 text-right">
                {t.elapsedMs}ms
              </span>
            )}
          </div>
        ))}
      </div>
      <Progress value={percent} className="h-1" />
    </div>
  );
}
