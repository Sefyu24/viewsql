/** A single message in the data generation chat */
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

/** Available AI models for data generation */
export const AI_MODELS = [
  { value: "sonnet", label: "Claude Sonnet", description: "Fast & capable" },
  { value: "haiku", label: "Claude Haiku", description: "Fastest & cheapest" },
] as const;

export type AIModel = (typeof AI_MODELS)[number]["value"];

/** Suggestion chips for quick prompts */
export const SUGGESTIONS = [
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
] as const;
