"use client";

import { useCallback, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "next-themes";
import { keymap } from "@codemirror/view";
import type { SchemaTable } from "@/lib/sql/introspect";

export function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  schema?: SchemaTable[];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const runKeymap = useCallback(() => {
    if (!onRun) return [];
    return keymap.of([
      {
        key: "Mod-Enter",
        run: () => {
          onRun();
          return true;
        },
      },
    ]);
  }, [onRun]);

  const sqlExtension = useMemo(
    () =>
      sql({
        dialect: PostgreSQL,
        schema: schema?.reduce(
          (acc, t) => {
            acc[t.name] = t.columns.map((c) => c.name);
            return acc;
          },
          {} as Record<string, string[]>
        ),
      }),
    [schema]
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[sqlExtension, runKeymap()]}
      theme={isDark ? oneDark : undefined}
      placeholder="Write your SQL query here... (Cmd+Enter to run)"
      className="h-full text-sm"
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        bracketMatching: true,
        autocompletion: true,
      }}
    />
  );
}
