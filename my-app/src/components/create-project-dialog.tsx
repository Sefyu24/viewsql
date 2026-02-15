"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { createPGliteInstance } from "@/lib/pglite";
import { introspectSchema, type SchemaTable } from "@/lib/sql/introspect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SchemaPreview } from "@/components/schema-preview";

/**
 * Dialog for creating a new project.
 *
 * The user enters a project name and pastes their PostgreSQL DDL.
 * Clicking "Validate" spins up a temporary PGlite instance to execute the DDL —
 * if it succeeds, the parsed schema is previewed; if it fails, the Postgres
 * error is shown. On "Create", the raw DDL is saved to Convex.
 *
 * @param children - The trigger element that opens the dialog (e.g. a button).
 */
export function CreateProjectDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [schemaSql, setSchemaSql] = useState("");
  const [validating, setValidating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SchemaTable[] | null>(null);

  const createProject = useMutation(api.projects.createProject);

  /**
   * Validate DDL by executing it in a temporary PGlite instance.
   * If valid, introspect the schema and show a preview.
   */
  const handleValidate = useCallback(async () => {
    setValidating(true);
    setError(null);
    setPreview(null);

    let db;
    try {
      db = await createPGliteInstance({ initSql: schemaSql });
      const result = await introspectSchema(db);
      if (result.error) {
        setError(result.error);
      } else if (result.tables.length === 0) {
        setError("No tables found. Make sure your DDL contains CREATE TABLE statements.");
      } else {
        setPreview(result.tables);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (db) await db.close().catch(() => {});
      setValidating(false);
    }
  }, [schemaSql]);

  /**
   * Save the project to Convex and close the dialog.
   */
  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      await createProject({ name, schemaSql });
      setOpen(false);
      setName("");
      setSchemaSql("");
      setPreview(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [name, schemaSql, createProject]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="My Database"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schema-sql">Schema DDL</Label>
            <Textarea
              id="schema-sql"
              placeholder={`Paste your PostgreSQL DDL here...\n\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL\n);`}
              className="min-h-[200px] font-mono text-sm"
              value={schemaSql}
              onChange={(e) => {
                setSchemaSql(e.target.value);
                setPreview(null);
                setError(null);
              }}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {preview && <SchemaPreview tables={preview} />}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={!schemaSql.trim() || validating}
            >
              {validating ? "Validating..." : "Validate"}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !preview || creating}
            >
              {creating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
