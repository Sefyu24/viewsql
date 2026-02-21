"use client";

import { useState } from "react";
import { Copy, Pencil, Play, Check, X, Database, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DataGenConfig } from "@/lib/data-gen/types";

function generatorLabel(gen?: { type?: string; method?: string; table?: string; values?: unknown[] }): string {
  if (!gen?.type) return "...";
  switch (gen.type) {
    case "faker":
      return gen.method ?? "faker";
    case "foreignKey":
      return `FK → ${gen.table ?? "?"}`;
    case "sequence":
      return "sequence";
    case "oneOf":
      return `oneOf(${gen.values?.length ?? 0})`;
    case "weightedOneOf":
      return "weighted";
    case "null":
      return "NULL";
    default:
      return gen.type;
  }
}

export function ConfigPreviewCard({
  config,
  onExecute,
  onConfigChange,
  isExecuting,
}: {
  config: DataGenConfig;
  onExecute?: () => void;
  onConfigChange?: (config: DataGenConfig) => void;
  isExecuting?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DataGenConfig>(config);
  const [copied, setCopied] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const activeConfig = isEditing ? draft : config;
  const totalRows = activeConfig.tables.reduce((sum, t) => sum + t.rowCount, 0);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    setDraft(JSON.parse(JSON.stringify(config)));
    setIsEditing(true);
  };

  const handleSave = () => {
    onConfigChange?.(draft);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(config);
    setIsEditing(false);
  };

  const updateRowCount = (tableIndex: number, value: number) => {
    const next = JSON.parse(JSON.stringify(draft)) as DataGenConfig;
    next.tables[tableIndex].rowCount = Math.max(1, value);
    setDraft(next);
  };

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
          Data Config
          <Badge variant="secondary" className="text-[10px] font-normal ml-1">
            {activeConfig.tables.length} table{activeConfig.tables.length !== 1 ? "s" : ""} · {totalRows.toLocaleString()} rows
          </Badge>
        </CardTitle>
        <CardAction className="flex items-center gap-0.5">
          {isEditing ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
                      <Check className="h-3 w-3 text-emerald-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Save changes</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancel}>
                      <X className="h-3 w-3 text-red-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Cancel</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{copied ? "Copied!" : "Copy JSON"}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleEdit}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Edit config</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="px-3 py-0 space-y-0.5">
        {activeConfig.tables.map((table, tableIndex) => {
          if (!table) return null;
          const name = table.tableName ?? `table-${tableIndex}`;
          return (
          <Collapsible
            key={name}
            open={expandedTables.has(name)}
            onOpenChange={() => toggleTable(name)}
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 px-1 rounded hover:bg-accent/50 transition-colors text-xs group">
              <ChevronRight
                className={`h-3 w-3 text-muted-foreground transition-transform ${
                  expandedTables.has(name) ? "rotate-90" : ""
                }`}
              />
              <Database className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium flex-1 text-left truncate">
                {name}
              </span>
              {isEditing ? (
                <Input
                  type="number"
                  min={1}
                  value={draft.tables[tableIndex]?.rowCount ?? 0}
                  onChange={(e) => updateRowCount(tableIndex, parseInt(e.target.value) || 1)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-16 text-[10px] text-right px-1"
                />
              ) : (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {table.rowCount ?? 0} rows
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                {(table.columns ?? []).length} col{(table.columns ?? []).length !== 1 ? "s" : ""}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-8 mb-1 space-y-0.5">
                {(table.columns ?? []).map((col, colIndex) => (
                  <div
                    key={col?.columnName ?? colIndex}
                    className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5"
                  >
                    <span className="font-mono flex-1 truncate">{col?.columnName ?? "..."}</span>
                    <span className="font-mono text-muted-foreground/70">
                      {generatorLabel(col?.generator)}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
          );
        })}
      </CardContent>

      {onExecute && (
        <CardFooter className="px-3 py-0 pt-1">
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs w-full"
            onClick={onExecute}
            disabled={isExecuting}
          >
            <Play className="h-3 w-3" />
            {isExecuting ? "Generating..." : "Generate Data"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
