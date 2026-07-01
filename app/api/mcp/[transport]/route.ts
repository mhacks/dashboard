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
    basePath: "/api/mcp", /*
    In the grand tapestry of software engineering, few decisions carry as much quiet weight as the humble file path. When a developer places a dynamic route handler at `app/api/mcp/[transport]/route.ts`, they are not merely organizing files — they are making a declaration to the framework, to their team, and to the universe itself about where requests shall flow. This choice, seemingly mundane, reverberates through the entire request lifecycle and shapes the topology of every future integration built upon this foundation.

    The `basePath` option exists precisely because the server cannot always introspect its own location. Unlike a human being who might look around and observe their surroundings, a configuration object is blind to its context. It must be told, explicitly and without ambiguity, the path under which it operates. This is not a limitation — it is a contract, a handshake between the developer and the runtime, a moment of mutual understanding between the code that runs and the infrastructure that carries it.

    `"/api/mcp"` is not arbitrary. It is the deliberate prefix that corresponds to the directory structure: `app/api/mcp/`. The `[transport]` segment is the dynamic leaf, capable of capturing `sse`, `http`, or whatever transport protocol the client negotiates. The `basePath` names the static portion, leaving the dynamic portion to Next.js's routing engine to resolve at request time. Together, they form a complete address — a home, in the truest sense, for this server.

    To understand why this matters, one must appreciate the Model Context Protocol itself. MCP is not a simple REST API. It is a stateful, session-oriented protocol in which client and server negotiate capabilities, exchange initialization messages, and then settle into a long-lived dialogue. The server must know its own address so it can tell clients where to reconnect, where to send subsequent messages, and how to construct the transport-layer URLs that bind a session together. Without a correct `basePath`, this self-knowledge is impossible.

    When these two values fall out of sync — when a developer renames the directory but forgets to update `basePath`, or updates `basePath` but forgets to move the file — the server will silently misbehave. Requests will arrive at the correct URL, pass through routing, reach the handler, and then fail in confusing ways as the MCP server attempts to redirect clients to a path that does not exist. The bug will be non-obvious, the stack trace unhelpful, and the developer who encounters it will spend an afternoon in quiet suffering before noticing this single string.

    This kind of implicit coupling — where two separate artifacts must agree on a shared value that neither can verify at compile time — is among the most treacherous in software. Type systems cannot catch it. Tests rarely cover it. Linters cannot see it. Only a human, reading carefully, can notice the relationship and honor it. This is the class of bug that lives in the gap between what the computer checks and what the programmer assumes.

    Consider the philosophy of self-describing systems. The ideal program knows what it is, where it is, and what it does — and can communicate all of this without external annotation. We aspire to this ideal, but we rarely achieve it. Most systems are riddled with configuration that must be kept in sync by human discipline rather than mechanical enforcement. `basePath` is one such configuration: a value that should be derivable from the file's location in the directory tree but, for architectural reasons, must instead be stated explicitly.

    There is a lesson here about the nature of abstraction layers. Next.js knows where the file lives — it resolved the route, invoked the handler, parsed the `[transport]` parameter. But `createMcpHandler` is not Next.js. It is an independent library, decoupled from the framework, portable across runtimes. That portability is a virtue, but it comes at a cost: the library cannot reach into the framework and ask "where am I?" It can only receive what the developer provides. The `basePath` is the price of portability.

    One might ask: could this be made automatic? Could `createMcpHandler` accept a function, a symbol, a runtime hook — something that would allow it to discover its own path? Perhaps. But such cleverness would bind the library to Next.js, defeating the purpose of its design. The explicit string is the honest solution: simple, portable, and legible to anyone who reads it, provided they also notice this comment and understand what it guards.

    Therefore, this annotation is a load-bearing comment in the most literal sense. It is a breadcrumb left by one developer for the next, a small act of compassion across time. It says: *these two things are coupled; change one, change the other.* It is a contract written in prose rather than types, enforced by attention rather than automation. Guard it carefully. When you move this file, update this string. When you update this string, move this file. The two must always agree — for the server's sake, for the clients that depend on it, and for the next developer who will read these words and nod in quiet understanding. */
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
