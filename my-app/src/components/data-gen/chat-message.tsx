"use client";

import type { UIMessage } from "ai";
import Markdown from "react-markdown";
import { Sparkles } from "lucide-react";
import { ConfigPreviewCard } from "./config-preview-card";
import { ResultsSummaryCard } from "./results-summary-card";
import { SuggestionChips } from "./suggestion-chips";
import {
  getConfigSuggestions,
  getSuccessSuggestions,
  getErrorSuggestions,
  type ExecutionState,
} from "./types";
import type { DataGenConfig } from "@/lib/data-gen/types";

/** Extract a DataGenConfig from a tool part, checking input then rawInput. */
function extractConfig(
  toolPart: { input?: unknown; rawInput?: unknown },
  editedConfigs: Map<string, DataGenConfig>,
  toolCallId: string,
): DataGenConfig | undefined {
  const edited = editedConfigs.get(toolCallId);
  if (edited) return edited;

  const candidate = (toolPart.input ?? toolPart.rawInput) as
    | DataGenConfig
    | undefined;
  return candidate?.tables ? candidate : undefined;
}

/** Check if a message part is a tool invocation (static or dynamic). */
function isToolInvocationPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

/** Shared markdown component config for AI messages. */
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-2 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="text-xs px-1.5 py-0.5 bg-accent rounded font-mono">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 p-3 bg-accent rounded-md text-xs overflow-x-auto font-mono">
      {children}
    </pre>
  ),
};

export function ChatMessageBubble({
  message,
  isLastAssistant,
  isStreaming,
  executionResults,
  editedConfigs,
  onExecute,
  onConfigChange,
  onSendMessage,
  onAction,
  isExecuting,
}: {
  message: UIMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  executionResults: Map<string, ExecutionState>;
  editedConfigs: Map<string, DataGenConfig>;
  onExecute: (config: DataGenConfig, toolCallId: string) => void;
  onConfigChange: (toolCallId: string, config: DataGenConfig) => void;
  onSendMessage: (prompt: string) => void;
  onAction: (action: string) => void;
  isExecuting: boolean;
}) {
  const isUser = message.role === "user";

  const textParts = message.parts?.filter((p) => p.type === "text") ?? [];
  const textContent = textParts
    .map((p) => (p as { text: string }).text)
    .join("");

  const toolParts =
    message.parts?.filter((p) => isToolInvocationPart(p)) ?? [];

  // Suggestions for last assistant message
  let suggestions = null;
  if (isLastAssistant && !isStreaming && !isUser) {
    if (toolParts.length > 0) {
      const hasExecution = toolParts.some((p) => {
        const toolCallId = (p as { toolCallId?: string }).toolCallId;
        return toolCallId && executionResults.has(toolCallId);
      });
      if (hasExecution) {
        const lastToolCallId = (
          toolParts[toolParts.length - 1] as { toolCallId?: string }
        ).toolCallId;
        const execState = lastToolCallId
          ? executionResults.get(lastToolCallId)
          : undefined;
        suggestions = execState?.result.success
          ? getSuccessSuggestions()
          : getErrorSuggestions();
      } else {
        suggestions = getConfigSuggestions();
      }
    }
  }

  /* ── User message: compact right-aligned pill ── */
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl px-4 py-2 text-sm bg-primary text-primary-foreground max-w-[80%]">
          {textContent}
        </div>
      </div>
    );
  }

  /* ── Assistant message: full-width, no bubble ── */
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>

      <div className="flex-1 min-w-0 text-sm text-foreground">
        {/* Text content */}
        {textContent && (
          <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Markdown components={markdownComponents}>{textContent}</Markdown>
            {isStreaming && (
              <span className="animate-pulse ml-0.5 text-muted-foreground">
                |
              </span>
            )}
          </div>
        )}

        {/* Tool invocations */}
        {toolParts.map((part) => {
          const toolPart = part as {
            type: string;
            toolCallId: string;
            state: string;
            input?: Record<string, unknown>;
            rawInput?: Record<string, unknown>;
          };
          const toolCallId = toolPart.toolCallId;
          const config = extractConfig(toolPart, editedConfigs, toolCallId);
          const execState = executionResults.get(toolCallId);

          if (!config) return null;

          return (
            <div key={toolCallId}>
              {!execState ? (
                <ConfigPreviewCard
                  config={config}
                  onExecute={() => onExecute(config, toolCallId)}
                  onConfigChange={(newConfig) =>
                    onConfigChange(toolCallId, newConfig)
                  }
                  isExecuting={isExecuting}
                />
              ) : (
                <ResultsSummaryCard
                  result={execState.result}
                  sampleData={execState.sampleData}
                />
              )}
            </div>
          );
        })}

        {/* Suggestion chips */}
        {suggestions && (
          <SuggestionChips
            suggestions={suggestions}
            onSendMessage={onSendMessage}
            onAction={onAction}
            disabled={isExecuting || isStreaming}
          />
        )}
      </div>
    </div>
  );
}
