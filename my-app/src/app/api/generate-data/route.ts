import { auth } from "@clerk/nextjs/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { buildSystemPrompt } from "@/lib/data-gen/prompt";
import type { SchemaTable } from "@/lib/sql/introspect";

const MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-5-20250929",
  haiku: "claude-haiku-4-5-20251001",
};

export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Data generation is not configured. Add ANTHROPIC_API_KEY to .env.local." },
      { status: 500 }
    );
  }

  let body: {
    messages: UIMessage[];
    schema: SchemaTable[];
    model: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messages, schema, model } = body;

  if (!messages?.length || !schema?.length) {
    return Response.json(
      { error: "Missing messages or schema" },
      { status: 400 }
    );
  }

  const result = streamText({
    model: anthropic(MODEL_MAP[model] ?? MODEL_MAP.sonnet),
    maxOutputTokens: 4096,
    system: buildSystemPrompt(schema),
    messages: await convertToModelMessages(messages),
    tools: {
      generate_data_config: {
        description:
          "Generate a faker.js data configuration for populating database tables with realistic test data. Returns a structured config that the client-side engine will execute.",
        inputSchema: z.object({
          tables: z.array(
            z.object({
              tableName: z.string().describe("The database table name"),
              rowCount: z.number().describe("Number of rows to generate"),
              columns: z.array(
                z.object({
                  columnName: z.string().describe("The column name"),
                  generator: z.object({
                    type: z
                      .enum(["faker", "foreignKey", "sequence", "oneOf", "weightedOneOf", "null"])
                      .describe("Generator type"),
                    method: z.string().optional().describe("For type=faker: dot-path to faker method"),
                    params: z.record(z.string(), z.unknown()).optional().describe("For type=faker: parameters"),
                    table: z.string().optional().describe("For type=foreignKey: parent table name"),
                    column: z.string().optional().describe("For type=foreignKey: parent column name"),
                    start: z.number().optional().describe("For type=sequence: starting value"),
                    step: z.number().optional().describe("For type=sequence: increment per row"),
                    values: z.array(z.unknown()).optional().describe("For type=oneOf: values to pick from"),
                    options: z
                      .array(z.object({ value: z.unknown(), weight: z.number() }))
                      .optional()
                      .describe("For type=weightedOneOf: weighted options"),
                  }),
                  nullProbability: z
                    .number()
                    .optional()
                    .describe("0-1 probability of generating NULL"),
                })
              ),
            })
          ),
        }),
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
