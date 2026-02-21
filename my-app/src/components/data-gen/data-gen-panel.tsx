"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Plus, Sparkles } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatMessageBubble } from "./chat-message";
import { SchemaMiniMap } from "./schema-mini-map";
import { ContextBar } from "./context-bar";
import { SuggestionChips } from "./suggestion-chips";
import { ExecutionProgressView } from "./execution-progress";
import { AI_MODELS, SUGGESTIONS, type AIModel, type ExecutionState } from "./types";
import type { ExecutionProgress } from "@/lib/data-gen/types";
import type { DataGenConfig } from "@/lib/data-gen/types";
import { usePGliteContext } from "@/providers/pglite-provider";
import type { SchemaTable } from "@/lib/sql/introspect";

/**
 * Data generation chat panel.
 *
 * Users describe what test data they want in natural language.
 * Claude generates a faker.js config (streamed via AI SDK), which is
 * executed client-side to INSERT rows into PGlite.
 */
export function DataGenPanel({
  schema,
  onClose,
  onDataGenerated,
}: {
  schema: SchemaTable[];
  onClose?: () => void;
  onDataGenerated?: () => void;
}) {
  const { db, isLoading: pgliteLoading } = usePGliteContext();
  const [model, setModel] = useState<AIModel>("sonnet");
  const [input, setInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);
  const [totalRowsGenerated, setTotalRowsGenerated] = useState(0);

  // Execution results keyed by the tool call ID that produced the config
  const [executionResults, setExecutionResults] = useState<Map<string, ExecutionState>>(new Map());
  // User-edited configs keyed by tool call ID
  const [editedConfigs, setEditedConfigs] = useState<Map<string, DataGenConfig>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/generate-data",
        body: { schema, model },
      }),
    [schema, model]
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport,
  });

  const isStreaming = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming, executionProgress]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      sendMessage({ text: text.trim() });
      setInput("");
    },
    [isStreaming, sendMessage]
  );

  const executeConfig = useCallback(
    async (config: DataGenConfig, toolCallId: string) => {
      if (!db || isExecuting) return;
      setIsExecuting(true);
      setExecutionProgress(null);

      try {
        const { executeDataGen } = await import("@/lib/data-gen/faker-engine");
        const result = await executeDataGen(config, db, schema, undefined, (progress) => {
          setExecutionProgress(progress);
        });

        // Fetch sample data for successful tables
        const sampleData = new Map<string, Record<string, unknown>[]>();
        for (const table of result.tablesInserted) {
          const sample = await db.query<Record<string, unknown>>(
            `SELECT * FROM "${table.tableName}" LIMIT 5`
          );
          sampleData.set(table.tableName, sample.rows);
        }

        setExecutionResults((prev) => {
          const next = new Map(prev);
          next.set(toolCallId, { result, sampleData });
          return next;
        });

        setTotalRowsGenerated((prev) => prev + result.totalRows);

        if (result.tablesInserted.length > 0) {
          onDataGenerated?.();
        }
      } catch (error) {
        setExecutionResults((prev) => {
          const next = new Map(prev);
          next.set(toolCallId, {
            result: {
              success: false,
              tablesInserted: [],
              errors: [{ tableName: "(all)", error: error instanceof Error ? error.message : String(error) }],
              totalRows: 0,
              durationMs: 0,
            },
          });
          return next;
        });
      } finally {
        setIsExecuting(false);
        setExecutionProgress(null);
      }
    },
    [db, schema, isExecuting, onDataGenerated]
  );

  const handleConfigChange = useCallback((toolCallId: string, config: DataGenConfig) => {
    setEditedConfigs((prev) => {
      const next = new Map(prev);
      next.set(toolCallId, config);
      return next;
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleNewChat = () => {
    stop();
    setMessages([]);
    setInput("");
    setExecutionResults(new Map());
    setEditedConfigs(new Map());
    setExecutionProgress(null);
  };

  const handleAction = useCallback(
    (action: string) => {
      if (action === "navigate_editor") {
        onClose?.();
      }
    },
    [onClose]
  );

  const pgliteStatus = pgliteLoading ? "loading" : db ? "active" : "error";
  const showWelcome = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">Generate Data</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={(v) => setModel(v as AIModel)}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  <span>{m.label}</span>
                  <span className="ml-1 text-muted-foreground">
                    — {m.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNewChat}
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Context bar */}
      <ContextBar
        schema={schema}
        pgliteStatus={pgliteStatus as "loading" | "active" | "error"}
        totalRowsGenerated={totalRowsGenerated}
      />

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {/* Welcome message */}
          {showWelcome && (
            <div>
              <div className="text-sm text-foreground">
                <p className="leading-relaxed">
                  I can help you generate test data for your{" "}
                  <strong className="font-semibold">{schema.length} table{schema.length !== 1 ? "s" : ""}</strong>.
                  Describe what kind of data you need, or pick a suggestion below.
                </p>
                <SchemaMiniMap schema={schema} />
                <SuggestionChips
                  suggestions={SUGGESTIONS}
                  onSendMessage={handleSend}
                  onAction={handleAction}
                  disabled={isStreaming}
                />
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, index) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              isLastAssistant={
                msg.role === "assistant" &&
                index === messages.length - 1
              }
              isStreaming={isStreaming && msg.role === "assistant" && index === messages.length - 1}
              executionResults={executionResults}
              editedConfigs={editedConfigs}
              onExecute={(config, toolCallId) => executeConfig(config, toolCallId)}
              onConfigChange={handleConfigChange}
              onSendMessage={handleSend}
              onAction={handleAction}
              isExecuting={isExecuting}
            />
          ))}

          {/* Execution progress */}
          {isExecuting && executionProgress && (
            <ExecutionProgressView progress={executionProgress} />
          )}

          {/* Streaming indicator */}
          {isStreaming && messages.length > 0 && (
            (() => {
              const lastMsg = messages[messages.length - 1];
              const hasText = lastMsg?.role === "assistant" && lastMsg.parts?.some((p) => p.type === "text" && p.text);
              if (hasText) return null;
              return (
                <div className="text-sm text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                  </span>
                  <span className="ml-2">
                    Analyzing your {schema.length}-table schema...
                  </span>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the data you want..."
            className="min-h-[36px] max-h-[120px] resize-none text-xs"
            rows={1}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isStreaming || isExecuting}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
