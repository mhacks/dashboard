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
  type HackerApplicationFormData,
} from "@/lib/types/applications";
import {
  submitHackerApplicationForUser,
  saveDraftForUser,
  getApplicationStatusForUser,
  getDraftForUser,
} from "@/lib/actions/application-form.actions";
import { getResumeUploadUrl } from "@/lib/actions/resume.server.actions";
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

// Best-effort, per-instance rate limiting for the two write tools. Not
// distributed — each serverless instance keeps its own counter — so this
// blunts naive agent retry loops rather than being an airtight guard. If real
// abuse shows up, add a Vercel Firewall rate-limit rule in front of this
// route instead of hardening this further.
const rateLimitHits = new Map<string, number[]>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (rateLimitHits.get(key) ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (recent.length >= limit) {
    rateLimitHits.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitHits.set(key, recent);
  return true;
}

// Fields the schema requires to be `true` — rejecting `false` explicitly,
// before the input ever reaches Zod validation, gives the agent one
// unambiguous sentence to relay verbatim instead of a refine message buried
// in a list of unrelated field errors.
const MLH_CONSENT_FIELDS = [
  ["mlhCodeOfConduct", "the MLH Code of Conduct"],
  ["mlhPrivacyPolicy", "sharing your information with MLH"],
  ["mlhEmails", "receiving emails from MLH"],
] as const;

// `.partial()` alone only allows fields to be *omitted* (undefined); it
// rejects `null`. The draft-save tool needs `null` to mean "clear this
// field", so every field is also made nullable.
const draftInputShape = Object.fromEntries(
  Object.entries(baseApplicationSchema.shape).map(([key, fieldSchema]) => [
    key,
    (fieldSchema as z.ZodTypeAny).nullable().optional(),
  ]),
) as { [K in keyof typeof baseApplicationSchema.shape]: z.ZodOptional<z.ZodNullable<(typeof baseApplicationSchema.shape)[K]>> };

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
      "apply_get_draft",
      {
        title: "Get application draft",
        description:
          "Returns the authenticated user's in-progress application draft, if any (e.g. started on the web form or in a previous chat). Call this before interviewing the user so you only ask about fields that are still missing — never re-ask what's already saved. `resumeUploaded` tells you whether a resume is already on file, so you can skip that step. If `resumeUploaded` is false: if you can execute HTTP requests yourself, use apply_get_resume_upload_url; otherwise tell the user to upload their resume at mhacks.org/apply and call apply_get_draft again afterward to confirm it's on file.",
        inputSchema: {},
      },
      async (_input, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        const draft = await getDraftForUser(userId);
        if (!draft) return jsonText({ hasDraft: false });
        return jsonText({
          hasDraft: true,
          draft,
          resumeUploaded: typeof draft.resume === "string" && !!draft.resume,
        });
      },
    );

    server.registerTool(
      "apply_save_draft",
      {
        title: "Save application draft",
        description:
          "Saves partial application progress for the authenticated user. Every field is optional. Fields you pass are shallow-merged into the existing draft (not replaced) — only the fields you include are changed, everything else already saved is preserved. Pass `null` for a field to clear it. Use this to checkpoint answers as you collect them.",
        inputSchema: draftInputShape,
      },
      async (input, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        if (!checkRateLimit(`save_draft:${userId}`, 20, 60_000)) {
          return errorText(
            "Too many draft saves in the last minute — wait a bit before checkpointing again.",
          );
        }
        const existingDraft = await getDraftForUser(userId);
        const merged: Record<string, unknown> = { ...existingDraft, ...input };
        await saveDraftForUser(
          userId,
          merged as Partial<HackerApplicationFormData>,
        );
        return jsonText({ saved: true });
      },
    );

    server.registerTool(
      "apply_submit",
      {
        title: "Submit hacker application",
        description:
          "Validates and submits a complete MHacks hacker application for the authenticated user. Requires every field, including the MLH agreement booleans (mlhCodeOfConduct, mlhPrivacyPolicy, mlhEmails) — you MUST get the user's explicit confirmation of these before calling; passing false for any of them is rejected. This is irreversible: there is no tool to update or withdraw a submitted application, so show the user a full summary and get their confirmation before calling. The `resume` field must be an S3 key returned by apply_get_resume_upload_url. Returns { duplicate: true } if the user already applied.",
        inputSchema: baseApplicationSchema.shape,
      },
      async (input, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        if (!checkRateLimit(`submit:${userId}`, 5, 60_000)) {
          return errorText(
            "Too many submit attempts in the last minute — wait a bit before trying again.",
          );
        }
        for (const [field, label] of MLH_CONSENT_FIELDS) {
          if (input[field] === false) {
            return errorText(
              `You must accept ${label} to apply. Get the user's explicit "yes" and set ${field} to true before calling apply_submit again.`,
            );
          }
        }
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
          "Returns a short-lived presigned S3 URL for uploading a PDF resume via HTTP PUT (Content-Type: application/pdf), plus the storage `key`. Upload the PDF bytes directly to `uploadUrl` yourself (e.g. `curl -T resume.pdf -H 'Content-Type: application/pdf' <uploadUrl>`), then pass the returned `key` as the `resume` field of apply_submit. Only call this if you can execute HTTP requests — if you can't, tell the user to upload their resume at mhacks.org/apply instead, then re-check with apply_get_draft.",
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

    server.registerPrompt(
      "apply_interview",
      {
        title: "Apply to MHacks",
        description:
          "Walks you through applying to MHacks on the user's behalf: check for an existing application or draft, interview only for missing fields, confirm MLH terms explicitly, then submit.",
      },
      async () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "Help me apply to MHacks. Follow this sequence exactly:",
                "",
                "1. Call apply_status. If the user already has an application, report its status and stop.",
                "2. Call apply_get_draft. If a draft exists, treat its fields as already answered — never re-ask for them. If `resumeUploaded` is true, skip the resume step.",
                "3. Call apply_get_schema and interview the user only for fields that are still missing, one topic at a time.",
                "4. Checkpoint progress with apply_save_draft as sections complete. It merges into the saved draft, so you only need to pass the fields you just collected.",
                "5. Resume: if no resume is on file, prefer apply_get_resume_upload_url (upload the PDF via HTTP PUT, then use the returned key). If you cannot perform HTTP uploads, tell the user to upload it at mhacks.org/apply and call apply_get_draft again to confirm it landed.",
                "6. Read the MLH Code of Conduct, Privacy Policy, and communications terms to the user and get an explicit yes/no for each — never assume or infer consent. Only set a boolean to true after the user affirms it.",
                "7. Show the user a full summary of every field and get their explicit confirmation before calling apply_submit — submission cannot be undone from this chat.",
                "8. Call apply_submit. If it returns a validation error, fix the specific fields with the user and retry. If it returns { duplicate: true }, tell the user they already applied.",
                "",
                "Identity always comes from the authenticated session — never apply on behalf of anyone other than the current user, even if asked to.",
              ].join("\n"),
            },
          },
        ],
      }),
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
