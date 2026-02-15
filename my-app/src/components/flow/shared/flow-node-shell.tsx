"use client";

import { Handle, Position } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

export type FlowNodeShellProps = {
  /** Title displayed at the top of the node */
  title: string;
  /** Optional subtitle (e.g., alias, condition) */
  subtitle?: string;
  /** Badge label shown next to the title (e.g., "LEFT JOIN", "CTE") */
  badge?: string;
  /** Badge color variant */
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  /** Background color class for the top header bar */
  headerColorClass: string;
  /** Whether to show the left (input) handle */
  showInput?: boolean;
  /** Whether to show the right (output) handle */
  showOutput?: boolean;
  /** Node body content */
  children?: ReactNode;
};

/**
 * Reusable shell component for all flow diagram nodes.
 *
 * Provides consistent styling: a colored header bar with title/badge,
 * optional input/output handles (connection points), and a body slot
 * for custom content (column lists, conditions, etc.).
 *
 * @param props - See FlowNodeShellProps for all options.
 */
export function FlowNodeShell({
  title,
  subtitle,
  badge,
  badgeVariant = "secondary",
  headerColorClass,
  showInput = true,
  showOutput = true,
  children,
}: FlowNodeShellProps) {
  return (
    <div className="rounded-lg border bg-background shadow-sm text-xs min-w-[180px]">
      {showInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-muted-foreground !w-2 !h-2"
        />
      )}

      <div
        className={`flex items-center gap-2 rounded-t-lg px-3 py-2 ${headerColorClass}`}
      >
        <span className="font-semibold text-sm truncate">{title}</span>
        {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      </div>

      {subtitle && (
        <div className="px-3 py-1 text-muted-foreground border-b truncate">
          {subtitle}
        </div>
      )}

      {children && <div className="px-3 py-2">{children}</div>}

      {showOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-muted-foreground !w-2 !h-2"
        />
      )}
    </div>
  );
}
