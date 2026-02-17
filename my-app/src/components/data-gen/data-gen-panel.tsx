"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatMessageBubble } from "./chat-message";
import { AI_MODELS, SUGGESTIONS, type AIModel, type ChatMessage } from "./types";
import { usePGliteContext } from "@/providers/pglite-provider";
import type { SchemaTable } from "@/lib/sql/introspect";
import type { DataGenConfig, DataGenResult } from "@/lib/data-gen/types";

function formatExecutionResult(result: DataGenResult): string {
  if (result.errors.length > 0 && result.tablesInserted.length === 0) {
    return `Data generation failed:\n${result.errors.map((e) => `- ${e.tableName}: ${e.error}`).join("\n")}`;
  }
  const summary = result.tablesInserted
    .map((t) => `- ${t.tableName}: ${t.rowCount} rows`)
    .join("\n");
  const errorPart =
    result.errors.length > 0
      ? `\n\nPartial errors:\n${result.errors.map((e) => `- ${e.tableName}: ${e.error}`).join("\n")}`
      : "";
  return `Inserted ${result.totalRows} rows in ${result.durationMs}ms:\n${summary}${errorPart}\n\nYou can now query the data in the SQL editor.`;
}

/**
 * Data generation chat panel.
 *
 * Users describe what test data they want in natural language.
 * Claude generates a faker.js config, which is executed client-side
 * to INSERT rows into PGlite.
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
  const { db } = usePGliteContext();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `I can help you generate test data for your database. You have ${schema.length} table${schema.length !== 1 ? "s" : ""}: ${schema.map((t) => t.name).join(", ")}. Describe what kind of data you need, or pick a suggestion below.`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<AIModel>("sonnet");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isGenerating) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsGenerating(true);

      const newHistory = [
        ...conversationHistory,
        { role: "user" as const, content: text.trim() },
      ];

      try {
        const response = await fetch("/api/generate-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newHistory, schema, model }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `API error: ${response.status}`);
        }

        const data = await response.json();

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.content || "Here's your data generation config.",
          timestamp: Date.now(),
          dataGenConfig: data.config ?? undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setConversationHistory([
          ...newHistory,
          { role: "assistant", content: data.content || "" },
        ]);
      } catch (error) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, schema, model, conversationHistory]
  );

  const executeConfig = useCallback(
    async (config: DataGenConfig) => {
      if (!db || isExecuting) return;
      setIsExecuting(true);

      try {
        const { executeDataGen } = await import("@/lib/data-gen/faker-engine");
        const result = await executeDataGen(config, db, schema);

        const resultMsg: ChatMessage = {
          id: `result-${Date.now()}`,
          role: "assistant",
          content: formatExecutionResult(result),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, resultMsg]);

        if (result.tablesInserted.length > 0) {
          onDataGenerated?.();
        }
      } catch (error) {
        const errorMsg: ChatMessage = {
          id: `exec-error-${Date.now()}`,
          role: "assistant",
          content: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsExecuting(false);
      }
    },
    [db, schema, isExecuting, onDataGenerated]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `I can help you generate test data for your database. You have ${schema.length} table${schema.length !== 1 ? "s" : ""}: ${schema.map((t) => t.name).join(", ")}. Describe what kind of data you need, or pick a suggestion below.`,
        timestamp: Date.now(),
      },
    ]);
    setInput("");
    setConversationHistory([]);
  };

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

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              onExecute={
                msg.dataGenConfig
                  ? () => executeConfig(msg.dataGenConfig!)
                  : undefined
              }
              isExecuting={isExecuting}
            />
          ))}
          {(isGenerating || isExecuting) && (
            <div className="flex gap-2">
              <div className="h-6 w-6 shrink-0" />
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                </span>
                <span className="ml-2">
                  {isExecuting ? "Inserting data..." : "Thinking..."}
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-2">
              Suggestions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <Badge
                  key={s.label}
                  variant="outline"
                  className="text-[11px] cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => sendMessage(s.prompt)}
                >
                  {s.label}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

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
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isGenerating || isExecuting}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
