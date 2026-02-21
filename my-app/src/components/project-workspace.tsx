"use client";

import { useState, useCallback, useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SqlEditor } from "@/components/sql-editor";
import { QueryToolbar } from "@/components/query-toolbar";
import { ResultsTable, type QueryResult } from "@/components/results-table";
import { QueryFlowCanvas } from "@/components/flow/QueryFlowCanvas";
import { SchemaSidebar } from "@/components/schema-sidebar";
import { DataGenPanel } from "@/components/data-gen/data-gen-panel";
import { usePGliteContext } from "@/providers/pglite-provider";
import { introspectSchema, type SchemaTable } from "@/lib/sql/introspect";

/**
 * Main project workspace layout.
 *
 * Composes the schema sidebar, SQL editor, query toolbar, and a tabbed
 * bottom panel with "Visualize" (flow diagram) and "Results" (query output).
 * Manages PGlite query execution and schema introspection.
 *
 * @param projectName - Display name shown in the header.
 * @param schemaSql - The raw DDL to initialize PGlite with (already loaded into the provider).
 */
export function ProjectWorkspace({
  projectName,
}: {
  projectName: string;
}) {
  const { db, isLoading: pgliteLoading } = usePGliteContext();
  const [sql, setSql] = useState("");
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("visualize");
  const [dataGenOpen, setDataGenOpen] = useState(false);

  // Introspect schema once PGlite is ready
  const refreshSchema = useCallback(async () => {
    if (!db) return;
    setSchemaLoading(true);
    const result = await introspectSchema(db);
    setSchema(result.tables);
    setSchemaLoading(false);
  }, [db]);

  useEffect(() => {
    refreshSchema();
  }, [refreshSchema]);

  /**
   * Execute the current SQL query against PGlite.
   */
  const handleRun = useCallback(async () => {
    if (!db || !sql.trim()) return;
    setIsRunning(true);
    setQueryError(null);
    setQueryResult(null);
    setActiveTab("results");

    try {
      const result = await db.query(sql);
      const columns =
        result.fields?.map((f: { name: string }) => f.name) ?? [];
      setQueryResult({
        columns,
        rows: result.rows as Record<string, unknown>[],
      });
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }, [db, sql]);

  const handleClear = useCallback(() => {
    setSql("");
    setQueryResult(null);
    setQueryError(null);
    setFlowError(null);
  }, []);

  if (pgliteLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">
          Loading database engine...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center border-b px-4 py-2">
        <h1 className="text-sm font-semibold">{projectName}</h1>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setDataGenOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Generate Data
          </Button>
        </div>
      </div>

      {/* Data generation chat panel */}
      <Sheet open={dataGenOpen} onOpenChange={setDataGenOpen}>
        <SheetContent side="left" className="w-[400px] sm:max-w-[440px] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Generate Test Data</SheetTitle>
          <DataGenPanel
            schema={schema}
            onClose={() => setDataGenOpen(false)}
            onDataGenerated={refreshSchema}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Schema sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
          <SchemaSidebar tables={schema} isLoading={schemaLoading} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor + visualization/results */}
        <ResizablePanel defaultSize={80}>
          <ResizablePanelGroup orientation="vertical">
            {/* SQL Editor */}
            <ResizablePanel defaultSize={40} minSize={20}>
              <div className="flex h-full flex-col">
                <QueryToolbar
                  onRun={handleRun}
                  onClear={handleClear}
                  isRunning={isRunning}
                />
                <div className="flex-1 overflow-hidden">
                  <SqlEditor
                    value={sql}
                    onChange={setSql}
                    onRun={handleRun}
                    schema={schema}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Visualize / Results tabs */}
            <ResizablePanel defaultSize={60} minSize={25}>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex h-full flex-col"
              >
                <TabsList className="mx-3 mt-2 w-fit">
                  <TabsTrigger value="visualize">Visualize</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                </TabsList>

                <TabsContent value="visualize" className="flex-1 m-0">
                  <QueryFlowCanvas
                    sql={sql}
                    schema={schema}
                    onError={setFlowError}
                  />
                  {flowError && (
                    <div className="absolute bottom-4 left-4 right-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {flowError}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="results" className="flex-1 m-0">
                  <ResultsTable result={queryResult} error={queryError} />
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
