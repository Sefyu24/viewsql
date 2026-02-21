import type { DataGenConfig, DataGenResult } from "@/lib/data-gen/types";

/** Available AI models for data generation */
export const AI_MODELS = [
  { value: "sonnet", label: "Claude Sonnet", description: "Fast & capable" },
  { value: "haiku", label: "Claude Haiku", description: "Fastest & cheapest" },
] as const;

export type AIModel = (typeof AI_MODELS)[number]["value"];

/** A contextual follow-up suggestion */
export type SuggestionChip = {
  label: string;
  prompt: string;
  /** Action-only chips trigger a callback instead of sending a message */
  action?: "execute" | "preview" | "navigate_editor";
};

/** Suggestion chips for the welcome message */
export const SUGGESTIONS: SuggestionChip[] = [
  {
    label: "E-commerce data",
    prompt: "Generate realistic e-commerce data with customers, orders, and products. Most orders should be recent.",
  },
  {
    label: "100 users",
    prompt: "Generate 100 users with realistic names, emails, and signup dates spread over the last year.",
  },
  {
    label: "Realistic dates",
    prompt: "Fill all tables with data where dates are concentrated in the last 3 months with a realistic distribution.",
  },
  {
    label: "Edge cases",
    prompt: "Generate data that includes edge cases: NULL values where allowed, very long strings, duplicate-ish names, and boundary dates.",
  },
];

/** Execution result stored alongside a message */
export type ExecutionState = {
  result: DataGenResult;
  sampleData?: Map<string, Record<string, unknown>[]>;
};

export function getConfigSuggestions(): SuggestionChip[] {
  return [
    { label: "Adjust row counts", prompt: "Change the row counts to be more realistic for a production-like dataset." },
    { label: "Add more tables", prompt: "Include data for the remaining tables I haven't configured yet." },
  ];
}

export function getSuccessSuggestions(): SuggestionChip[] {
  return [
    { label: "Run a query", prompt: "", action: "navigate_editor" },
    { label: "Generate more", prompt: "Generate additional rows for the same tables with different data." },
  ];
}

export function getErrorSuggestions(): SuggestionChip[] {
  return [
    { label: "Fix config", prompt: "Fix the configuration to avoid the errors above." },
    { label: "Explain error", prompt: "Explain why the data generation failed and suggest how to fix it." },
  ];
}
