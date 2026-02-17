"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage } from "./types";

/**
 * A single chat message bubble with avatar.
 *
 * User messages align right with a blue accent.
 * Assistant messages align left with a neutral background.
 */
export function ChatMessageBubble({ message }: { message: ChatMessage }) {
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
        {message.content}
      </div>
    </div>
  );
}
