"use client";

import { Badge } from "@/components/ui/badge";
import type { SuggestionChip } from "./types";

export function SuggestionChips({
  suggestions,
  onSendMessage,
  onAction,
  disabled,
}: {
  suggestions: SuggestionChip[];
  onSendMessage: (prompt: string) => void;
  onAction?: (action: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {suggestions.map((s, i) => (
        <Badge
          key={s.label}
          variant="outline"
          className="text-[11px] cursor-pointer hover:bg-accent transition-colors animate-in fade-in-0 slide-in-from-bottom-1"
          style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
          onClick={() => {
            if (disabled) return;
            if (s.action) {
              onAction?.(s.action);
            } else {
              onSendMessage(s.prompt);
            }
          }}
        >
          {s.label}
        </Badge>
      ))}
    </div>
  );
}
