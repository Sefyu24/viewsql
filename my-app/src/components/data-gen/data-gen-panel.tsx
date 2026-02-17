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
import type { SchemaTable } from "@/lib/sql/introspect";

/**
 * Data generation chat panel.
 *
 * A sidebar where users describe what test data they want in natural language.
 * The AI generates faker.js configurations based on the database schema context.
 *
 * @param schema - The current database schema for context.
 * @param onClose - Callback to close the panel.
 */
export function DataGenPanel({
  schema,
  onClose,
}: {
  schema: SchemaTable[];
  onClose?: () => void;
}) {
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

      // TODO: Replace with actual LLM API call
      // For now, simulate a response
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: `I'll generate data based on your request. Here's what I'll configure:\n\n${schema.map((t) => `• ${t.name}: 50 rows`).join("\n")}\n\nThe data generation config will appear here once the LLM integration is connected. For now, this is a placeholder response.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsGenerating(false);
      }, 1000);
    },
    [isGenerating, schema]
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
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
          {isGenerating && (
            <div className="flex gap-2">
              <div className="h-6 w-6 shrink-0" />
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
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
            disabled={!input.trim() || isGenerating}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
