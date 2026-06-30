// app/api/mcp/[transport]/route.ts
//
// MCP server that lets authenticated agents apply to MHacks on a user's behalf.
// Auth is OAuth 2.1 (Supabase GoTrue as the Authorization Server): every request
// must carry a verified bearer token, and the user identity comes from that
// token — never from a tool argument. Validation + persistence are shared with
// the web form via lib/actions/application-form.actions.ts.
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  baseApplicationSchema,
  hackerApplicationSchema,
} from "@/lib/types/applications";
import {
  submitHackerApplicationForUser,
  saveDraftForUser,
  getApplicationStatusForUser,
} from "@/lib/actions/application-form.actions";
import { getResumeUploadUrl } from "@/lib/aws/s3";
import { verifyToken } from "@/lib/mcp/auth";

// The verified token's identity is attached by withMcpAuth and surfaced to tool
// callbacks as `extra.authInfo`.
type ToolExtra = { authInfo?: { extra?: Record<string, unknown> } };

function requireUserId(extra: ToolExtra): string {
  const userId = extra?.authInfo?.extra?.userId;
  if (typeof userId !== "string") {
    throw new Error("Unauthorized: missing user identity");
  }
  return userId;
}

function jsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorText(text: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text }],
  };
}

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "apply_get_schema",
      {
        title: "Get application schema",
        description:
          "Returns the JSON Schema for an MHacks hacker application — all required fields, allowed values, and word/character limits. Call this first to learn what to collect from the user before drafting or submitting.",
        inputSchema: {},
      },
      async () => jsonText(z.toJSONSchema(hackerApplicationSchema)),
    );

    server.registerTool(
      "apply_save_draft",
      {
        title: "Save application draft",
        description:
          "Saves partial application progress for the authenticated user. Every field is optional; the user's draft is upserted. Use this to checkpoint answers as you collect them.",
        inputSchema: baseApplicationSchema.partial().shape,
      },
      async (input, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        await saveDraftForUser(userId, input);
        return jsonText({ saved: true });
      },
    );

    server.registerTool(
      "apply_submit",
      {
        title: "Submit hacker application",
        description:
          "Validates and submits a complete MHacks hacker application for the authenticated user. Requires every field, including the MLH agreement booleans (mlhCodeOfConduct, mlhPrivacyPolicy, mlhEmails) — you MUST get the user's explicit confirmation of these before calling. The `resume` field must be an S3 key returned by apply_get_resume_upload_url. Returns { duplicate: true } if the user already applied.",
        inputSchema: baseApplicationSchema.shape,
      },
      async (input, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        try {
          const { duplicate } = await submitHackerApplicationForUser(
            userId,
            input,
          );
          return jsonText(
            duplicate
              ? {
                  submitted: false,
                  duplicate: true,
                  message: "You have already submitted an application.",
                }
              : { submitted: true, duplicate: false },
          );
        } catch (err) {
          if (err instanceof z.ZodError) {
            return errorText(
              "Validation failed — fix these and retry:\n" +
                err.issues
                  .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
                  .join("\n"),
            );
          }
          return errorText(
            err instanceof Error ? err.message : "Failed to submit application",
          );
        }
      },
    );

    server.registerTool(
      "apply_status",
      {
        title: "Get application status",
        description:
          "Returns the authenticated user's submitted application and its review status (pending / reviewed / flagged), or indicates that no application exists yet.",
        inputSchema: {},
      },
      async (_input, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        const row = await getApplicationStatusForUser(userId);
        if (!row) return jsonText({ hasApplication: false });
        return jsonText({
          hasApplication: true,
          status: row.status,
          application: row,
        });
      },
    );

    server.registerTool(
      "apply_get_resume_upload_url",
      {
        title: "Get resume upload URL",
        description:
          "Returns a short-lived presigned S3 URL for uploading a PDF resume via HTTP PUT (Content-Type: application/pdf), plus the storage `key`. Upload the PDF bytes directly to `uploadUrl`, then pass the returned `key` as the `resume` field of apply_submit.",
        inputSchema: { fileName: z.string().min(1) },
      },
      async ({ fileName }, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        const { uploadUrl, key } = await getResumeUploadUrl(userId, fileName);
        return jsonText({
          uploadUrl,
          key,
          contentType: "application/pdf",
          expiresInSeconds: 300,
        });
      },
    );
  },
  {
    serverInfo: { name: "mhacks-apply", version: "1.0.0" },
  },
  {
    basePath: "/api/mcp", // must match where [transport] is located
    maxDuration: 60,
    verboseLogs: true,
  },
);

// Require a verified Supabase token carrying the application:write scope. On an
// unauthenticated request this responds 401 + WWW-Authenticate pointing at the
// protected-resource metadata, which kicks off the client's OAuth flow.
const handler = withMcpAuth(baseHandler, verifyToken, {
  required: true,
  requiredScopes: ["application:write"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST };
