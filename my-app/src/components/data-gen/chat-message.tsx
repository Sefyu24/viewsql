"use client";

import { Play } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "./types";

/**
 * A single chat message bubble with avatar.
 *
 * User messages align right with a blue accent.
 * Assistant messages align left with a neutral background.
 * Messages with a dataGenConfig show a compact summary and a "Generate Data" button.
 */
export function ChatMessageBubble({
  message,
  onExecute,
  isExecuting,
}: {
  message: ChatMessage;
  onExecute?: () => void;
  isExecuting?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarFallback
          className={`text-[10px] font-semibold ${
            isUser
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          }`}
        >
          {isUser ? "U" : "AI"}
        </AvatarFallback>
      </Avatar>

      <div
        className={`rounded-lg px-3 py-2 text-xs leading-relaxed max-w-[85%] ${
          isUser
            ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Config preview + execute button */}
        {message.dataGenConfig && (
          <div className="mt-2 space-y-2">
            <div className="rounded border bg-background/50 p-2 text-[10px] font-mono">
              {message.dataGenConfig.tables.map((t) => (
                <div key={t.tableName}>
                  <span className="font-semibold">{t.tableName}</span>
                  <span className="text-muted-foreground">
                    {" "}&mdash; {t.rowCount} rows, {t.columns.length} columns
                  </span>
                </div>
              ))}
            </div>
            {onExecute && (
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs w-full"
                onClick={onExecute}
                disabled={isExecuting}
              >
                <Play className="h-3 w-3" />
                {isExecuting ? "Generating..." : "Generate Data"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
