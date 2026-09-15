import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { formatQueryRows } from "./format";
import { getDatabaseSchemaPrompt } from "./schema-prompt";
import { runReadonlySql, SQL_ROW_LIMIT } from "./sql";

export async function answerQuestion(
  question: string,
  history: ModelMessage[] = [],
): Promise<string> {
  const schema = await getDatabaseSchemaPrompt();
  const { text, steps } = await generateText({
    model: languageModel(),
    system: `You answer organizer questions about the MHacks dashboard database.

${schema}

Rules:
- Call run_readonly_sql with a single SELECT or WITH … SELECT. Never mutate data.
- Prefer aggregates (counts, averages, top-N) over dumping essays or PII. Include PII only when the question asks for a specific person.
- Results are capped at ${SQL_ROW_LIMIT} rows. If the cap likely hid data, say so.
- Reply in Slack mrkdwn: short sentences, bullet lists, or a compact table. No surrounding quotes.
- If the tool returns an error, explain it briefly and try a corrected query once.`,
    messages: [...history, { role: "user", content: question }],
    tools: {
      run_readonly_sql: tool({
        description:
          "Run a read-only SELECT against the dashboard Postgres database. Returns JSON rows.",
        inputSchema: z.object({
          sql: z
            .string()
            .describe("A single SELECT or WITH … SELECT statement"),
        }),
        execute: async ({ sql }) => {
          const result = await runReadonlySql(sql);
          if (!result.ok) return result;
          return {
            ok: true,
            rowCount: result.rowCount,
            rows: result.rows,
          };
        },
      }),
    },
    stopWhen: stepCountIs(4),
  });

  const trimmed = text.trim();
  if (trimmed) return trimmed;

  const lastRows = lastSuccessfulRows(steps);
  if (lastRows) return formatQueryRows(lastRows);
  return "I could not produce an answer. Try rephrasing the question.";
}

function languageModel() {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY or OPENAI_API_KEY is not set");
  }
  const baseURL = process.env.OPENROUTER_BASE_URL;
  const openai = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  return openai(baseURL ? "openai/gpt-4o" : "gpt-4o");
}

function lastSuccessfulRows(
  steps: Awaited<ReturnType<typeof generateText>>["steps"],
): Record<string, unknown>[] | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    for (const result of steps[i].toolResults) {
      const output = result.output;
      if (
        typeof output === "object" &&
        output !== null &&
        "ok" in output &&
        output.ok === true &&
        "rows" in output &&
        Array.isArray(output.rows)
      ) {
        return output.rows as Record<string, unknown>[];
      }
    }
  }
  return null;
}
