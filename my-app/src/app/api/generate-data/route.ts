import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildToolDefinition } from "@/lib/data-gen/prompt";
import type { SchemaTable } from "@/lib/sql/introspect";
import type { DataGenConfig } from "@/lib/data-gen/types";

const MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-5-20250929",
  haiku: "claude-haiku-4-5-20251001",
};

export async function POST(request: Request) {
  // Auth check
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Data generation is not configured. Add ANTHROPIC_API_KEY to .env.local." },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Parse body
  let body: {
    messages: { role: "user" | "assistant"; content: string }[];
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

  try {
    const response = await anthropic.messages.create({
      model: MODEL_MAP[model] ?? MODEL_MAP.sonnet,
      max_tokens: 4096,
      system: buildSystemPrompt(schema),
      tools: [buildToolDefinition()],
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    // Extract text content and tool_use config from response
    let textContent = "";
    let config: DataGenConfig | null = null;

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (
        block.type === "tool_use" &&
        block.name === "generate_data_config"
      ) {
        config = block.input as DataGenConfig;
      }
    }

    return Response.json({
      content: textContent,
      config,
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "Rate limited. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "Invalid API key. Check your ANTHROPIC_API_KEY." },
        { status: 500 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
