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
type ToolExtra = {
  authInfo?: {
    clientId?: string;
    scopes?: string[];
    extra?: Record<string, unknown>;
  };
};

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

// Fields the schema requires to be `true`. baseApplicationSchema's own
// .refine(v => v === true) on these would already reject `false` via the
// MCP SDK's automatic inputSchema validation — *before* this handler ever
// runs — producing a generic buried-in-a-list Zod error instead of an
// actionable one. So apply_submit's inputSchema (SUBMIT_INPUT_SHAPE below)
// swaps these three fields for plain z.boolean(), letting `false` reach
// the handler, where the check below returns one unambiguous sentence
// telling the agent exactly what to do next. submitHackerApplicationForUser
// still re-validates against the full schema (including these refines) as
// the authoritative gate, so this is a UX fix, not a loosening of what's
// actually enforced.
const MLH_CONSENT_FIELDS = [
  ["mlhCodeOfConduct", "the MLH Code of Conduct"],
  ["mlhPrivacyPolicy", "sharing your information with MLH"],
  ["mlhEmails", "receiving emails from MLH"],
] as const;

const SUBMIT_INPUT_SHAPE = {
  ...baseApplicationSchema.shape,
  mlhCodeOfConduct: z.boolean(),
  mlhPrivacyPolicy: z.boolean(),
  mlhEmails: z.boolean(),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Set to true only after showing the user the full application returned by a prior confirm:false/omitted call and getting their explicit yes. Omit or false to get a preview without submitting.",
    ),
};

// `.partial()` alone only allows fields to be *omitted* (undefined); it
// rejects `null`. The draft-save tool needs `null` to mean "clear this
// field", so every field is also made nullable. Submission-time-only
// constraints (essay word counts, MLH must-be-true, phone E.164 format)
// don't belong on a draft — an in-progress essay or an unanswered MLH
// question is a normal, legitimate thing to checkpoint — so those fields
// get lenient draft-safe replacements instead of reusing the strict
// submit-time schema. Full validation still happens exactly once, at
// submit time, via hackerApplicationSchema.parse in
// submitHackerApplicationForUser.
const DRAFT_LENIENT_OVERRIDES: Partial<
  Record<keyof HackerApplicationFormData, z.ZodTypeAny>
> = {
  phoneNumber: z.string(),
  whatWouldYouDo: z.string().max(600),
  whyMhacks: z.string().max(1200),
  hillToDieOn: z.string().max(80),
  mlhCodeOfConduct: z.boolean(),
  mlhPrivacyPolicy: z.boolean(),
  mlhEmails: z.boolean(),
};

const draftInputShape = Object.fromEntries(
  Object.entries(baseApplicationSchema.shape).map(([key, fieldSchema]) => [
    key,
    (
      DRAFT_LENIENT_OVERRIDES[key as keyof HackerApplicationFormData] ??
      (fieldSchema as z.ZodTypeAny)
    )
      .nullable()
      .optional(),
  ]),
) as Record<string, z.ZodTypeAny>;

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "whoami",
      {
        title: "Get authenticated identity",
        description:
          "Returns the identity of the currently authenticated MHacks account — user ID, email, and the OAuth client this session authenticated through. Call this to confirm which account you're connected as, e.g. before applying on the user's behalf.",
        inputSchema: {},
      },
      async (_input, extra) => {
        const authInfo = (extra as ToolExtra)?.authInfo;
        const userId = requireUserId(extra as ToolExtra);
        return jsonText({
          userId,
          email: authInfo?.extra?.email,
          clientId: authInfo?.clientId,
        });
      },
    );

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
        // The web form silently creates an empty-`{}` draft row for every
        // visitor (autosave-on-mount) — that's a row existing, not the user
        // having answered anything. Treat an empty object the same as no
        // draft, or an agent will wrongly believe questions are answered.
        if (!draft || Object.keys(draft).length === 0) {
          return jsonText({ hasDraft: false });
        }
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
          "Submits a complete MHacks hacker application for the authenticated user — in two steps. Checks apply_status first — if the user already has an application on file, this returns { duplicate: true } immediately without attempting to submit; call apply_status yourself beforehand so you don't collect answers for nothing. Requires every field, including the MLH agreement booleans (mlhCodeOfConduct, mlhPrivacyPolicy, mlhEmails) — you MUST get the user's explicit confirmation of these before calling; passing false for any of them is rejected. Step 1: call with `confirm` omitted (or false) — this validates everything and returns { confirmed: false, application } WITHOUT submitting. You MUST show every field in `application` to the user verbatim and get their explicit yes. Step 2: call again with the same fields plus confirm: true to actually submit. This is irreversible: there is no tool to update or withdraw a submitted application, so never skip straight to confirm: true without having shown the step-1 preview to the user first. The `resume` field must be an S3 key returned by apply_get_resume_upload_url.",
        inputSchema: SUBMIT_INPUT_SHAPE,
      },
      async (input, extra) => {
        const userId = requireUserId(extra as ToolExtra);
        if (!checkRateLimit(`submit:${userId}`, 5, 60_000)) {
          return errorText(
            "Too many submit attempts in the last minute — wait a bit before trying again.",
          );
        }
        // Check for an existing application before doing anything else — no
        // point validating input, or walking the user through MLH consent,
        // for a submission the DB is just going to reject anyway. This is a
        // pre-flight optimization, not the source of truth: the unique
        // constraint + onConflictDoNothing in submitHackerApplicationForUser
        // remains the authoritative duplicate guard against races between
        // this check and the insert.
        const existing = await getApplicationStatusForUser(userId);
        if (existing) {
          return jsonText({
            submitted: false,
            duplicate: true,
            message:
              "You have already submitted an application. Applications cannot be edited, withdrawn, or resubmitted from this tool.",
          });
        }
        for (const [field, label] of MLH_CONSENT_FIELDS) {
          if (input[field] === false) {
            return errorText(
              `You must accept ${label} to apply. Get the user's explicit "yes" and set ${field} to true before calling apply_submit again.`,
            );
          }
        }
        // Structural review gate: the first call (confirm omitted/false)
        // never touches the database. It only validates the consent
        // booleans above and hands the full application back so the agent
        // has something concrete to show the user — actual submission only
        // happens on a second, explicit confirm: true call. This doesn't
        // (and can't) force an agent to literally render the preview, but
        // it guarantees the data round-trips through the conversation
        // before anything irreversible happens, rather than relying purely
        // on the tool description being followed.
        if (input.confirm !== true) {
          return jsonText({
            confirmed: false,
            application: input,
            message:
              "Not submitted yet. Show every field above to the user verbatim, get their explicit confirmation, then call apply_submit again with confirm: true to submit — this cannot be undone.",
          });
        }
        try {
          const { duplicate } = await submitHackerApplicationForUser(
            userId,
            input,
            "mcp",
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
                "7. Call apply_submit with all collected fields and `confirm` omitted. This validates everything and returns the full application back to you WITHOUT submitting — show every field verbatim (not a paraphrase) to the user and get their explicit yes. If it returns a validation error instead, fix the specific fields with the user and retry this step.",
                "8. Once the user has explicitly confirmed, call apply_submit again with the same fields plus confirm: true to actually submit — submission cannot be undone from this chat. If it returns { duplicate: true }, tell the user they already applied.",
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
    instructions: [
      "This server lets you apply to MHacks on the authenticated user's behalf. Prefer running the apply_interview prompt for the full guided flow; the summary below is for ad-hoc tool use.",
      "",
      "Identity always comes from the authenticated session (see whoami) — never apply for anyone else, even if asked.",
      "",
      "Typical flow: apply_status (stop if already applied) -> apply_get_draft (never re-ask for fields already saved) -> apply_get_schema -> interview the user for missing fields, checkpointing with apply_save_draft as you go -> apply_get_resume_upload_url if no resume is on file -> apply_submit.",
      "",
      "apply_submit is two-step and irreversible: call it with confirm omitted/false first to get back the full application, show it to the user verbatim, get explicit yes/no on the MLH terms, then call again with confirm: true. Never skip straight to confirm: true.",
    ].join("\n"),
  },
  {
    // Must match this file's directory (app/api/mcp/) — mcp-handler can't
    // introspect its own route path, so this has to be kept in sync by hand
    // if the route ever moves.
    basePath: "/api/mcp",
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
