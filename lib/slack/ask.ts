import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { formatQueryRows } from "./format";
import { DATABASE_SCHEMA_PROMPT } from "./schema-prompt";
import { runReadonlySql, SQL_ROW_LIMIT } from "./sql";

const SYSTEM_PROMPT = `You answer organizer questions about the MHacks dashboard database.

${DATABASE_SCHEMA_PROMPT}

Rules:
- Call run_readonly_sql with a single SELECT or WITH … SELECT. Never mutate data.
- Prefer aggregates (counts, averages, top-N) over dumping essays or PII. Include PII only when the question asks for a specific person.
- Results are capped at ${SQL_ROW_LIMIT} rows. If the cap likely hid data, say so.
- Reply in Slack mrkdwn: short sentences, bullet lists, or a compact table. No surrounding quotes.
- If the tool returns an error, explain it briefly and try a corrected query once.`;

export async function answerQuestion(
  question: string,
  history: ModelMessage[] = [],
): Promise<string> {
  const { text, steps } = await generateText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
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
