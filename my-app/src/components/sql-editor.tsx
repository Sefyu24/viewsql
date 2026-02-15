"use client";

import { useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "next-themes";
import { keymap } from "@codemirror/view";

/**
 * CodeMirror-based SQL editor with PostgreSQL syntax highlighting.
 *
 * Supports dark/light theme matching, Cmd/Ctrl+Enter to run queries,
 * and schema-aware SQL dialect configuration.
 *
 * @param value - The current SQL string.
 * @param onChange - Callback fired when the editor content changes.
 * @param onRun - Callback fired when user presses Cmd/Ctrl+Enter.
 */
export function SqlEditor({
  value,
  onChange,
  onRun,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
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

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[PostgreSQL, runKeymap()]}
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
