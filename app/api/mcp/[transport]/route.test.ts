// Integration tests for the MHacks apply MCP tools.
//
// "The agent" in production is just whatever sends MCP JSON-RPC `tools/call`
// messages over HTTP — nothing here requires an LLM. These tests replace the
// agent with the MCP SDK's `Client`, driven programmatically, and route its
// requests straight into this file's exported `POST` handler via a custom
// `fetch` implementation — no real network socket, but the exact same code
// path a real client hits: withMcpAuth -> verifyToken -> registerTool
// handlers -> Drizzle -> the local Postgres instance.
//
// Requires local Supabase running (`pnpm db:start`) and a service-role key:
//   SUPABASE_SERVICE_ROLE_KEY=<from `pnpm supabase status`> pnpm test
// Refuses to run against anything that isn't a local Supabase URL, same as
// scripts/register-mcp-client.ts.
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { POST } from "./route";

const MCP_URL = "http://localhost/api/mcp/mcp";
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isLocalSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(
  supabaseUrl,
);

// A complete, schema-valid application payload (minus the userId, which the
// server derives from the authenticated token, never from tool input).
const validApplication = {
  firstName: "Test",
  lastName: "Applicant",
  phoneNumber: "+13135550100",
  age: 21,
  gender: "female",
  ethnicity: "Asian",
  university: "University of Michigan",
  country: "USA",
  degree: "Bachelors",
  graduationYear: 2027,
  previousHackathons: 2,
  major: "Computer Science",
  resume: "resumes/test/fixture-resume.pdf",
  whatWouldYouDo:
    "This is placeholder text written only to satisfy the ten word minimum for this field in tests.",
  whyMhacks:
    "This is placeholder text used only to verify the MCP submission pipeline end to end during automated testing, written to satisfy the twenty word minimum required by the schema for this essay field.",
  hillToDieOn: "Tabs vs spaces",
  transportationType: "driving",
  comingFrom: "Ann Arbor, MI",
  shirtSize: "M",
  needsTravelReimbursement: false,
  mlhCodeOfConduct: true,
  mlhPrivacyPolicy: true,
  mlhEmails: true,
};

// Routes the SDK client's fetch calls directly into the real exported route
// handler (the same `withMcpAuth(...)` wrapper Next.js calls in production)
// without a listening socket. Next's Request/Response are the standard Web
// Fetch API classes, so this is calling production code, not a fake.
const testFetch: FetchLike = async (input, init) =>
  POST(new Request(input as string | URL, init));

// Every tool this server registers replies via the `jsonText`/`errorText`
// helpers in route.ts, which only ever produce a single text content block —
// narrower and simpler than the SDK's general CallToolResult union (which
// also allows image/audio/resource content and a legacy toolResult shape).
type TextToolResult = {
  content: { type: string; text: string }[];
  isError?: boolean;
};

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<TextToolResult> {
  return (await client.callTool({ name, arguments: args })) as TextToolResult;
}

function firstText(result: TextToolResult): string {
  const first = result.content[0];
  if (!first || first.type !== "text") {
    throw new Error(`Expected text content, got: ${JSON.stringify(result)}`);
  }
  return first.text;
}

async function connectClient(accessToken?: string) {
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: testFetch,
    requestInit: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
  await client.connect(transport);
  return client;
}

describe.skipIf(!serviceRoleKey || !publishableKey)(
  "apply_submit MCP tool (integration)",
  () => {
    const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey!);
    const anon: SupabaseClient = createClient(supabaseUrl, publishableKey!);

    let userId: string;
    let email: string;
    const password = `Test-${randomUUID()}!`;
    let accessToken: string;

    beforeAll(async () => {
      if (!isLocalSupabase) {
        throw new Error(
          `Refusing to run: NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") doesn't look local. ` +
            "These tests create and delete real auth users — only run them against a local Supabase instance.",
        );
      }
      email = `mcp-apply-test-${randomUUID()}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create test user: ${error?.message}`);
      }
      userId = data.user.id;

      const signIn = await anon.auth.signInWithPassword({ email, password });
      if (signIn.error || !signIn.data.session) {
        throw new Error(
          `Failed to sign in test user: ${signIn.error?.message}`,
        );
      }
      accessToken = signIn.data.session.access_token;
    });

    afterAll(async () => {
      // Cascades to hacker_applicants / hacker_application_drafts rows.
      if (userId) await admin.auth.admin.deleteUser(userId);
    });

    afterEach(async () => {
      await db
        .delete(hackerApplicants)
        .where(eq(hackerApplicants.userId, userId));
    });

    it("rejects requests with no bearer token", async () => {
      const res = await POST(
        new Request(MCP_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "unauthed-test", version: "1.0.0" },
            },
          }),
        }),
      );
      expect(res.status).toBe(401);
    });

    it("submits a fresh application and persists it", async () => {
      const client = await connectClient(accessToken);
      try {
        const result = await callTool(client, "apply_submit", validApplication);
        const body = JSON.parse(firstText(result));
        expect(body).toEqual({ submitted: true, duplicate: false });

        const rows = await db
          .select()
          .from(hackerApplicants)
          .where(eq(hackerApplicants.userId, userId));
        expect(rows).toHaveLength(1);
        expect(rows[0].firstName).toBe("Test");
      } finally {
        await client.close();
      }
    });

    it("short-circuits with duplicate:true when an application already exists, without re-validating input", async () => {
      const first = await connectClient(accessToken);
      try {
        await callTool(first, "apply_submit", validApplication);
      } finally {
        await first.close();
      }

      const second = await connectClient(accessToken);
      try {
        // Deliberately pass mlhCodeOfConduct: false — if the duplicate check
        // runs first (as intended), it's never evaluated, and we get
        // { duplicate: true } instead of an MLH consent error. (phoneNumber
        // is left valid: it uses z.e164() directly in the tool's inputSchema,
        // so a malformed value would be rejected by the MCP SDK's own
        // input-schema validation before the handler — and this duplicate
        // check — ever runs at all.)
        const result = await callTool(second, "apply_submit", {
          ...validApplication,
          mlhCodeOfConduct: false,
        });
        const body = JSON.parse(firstText(result));
        expect(body.submitted).toBe(false);
        expect(body.duplicate).toBe(true);

        const rows = await db
          .select()
          .from(hackerApplicants)
          .where(eq(hackerApplicants.userId, userId));
        expect(rows).toHaveLength(1);
      } finally {
        await second.close();
      }
    });

    it("rejects a fresh submission when MLH consent is false", async () => {
      const client = await connectClient(accessToken);
      try {
        const result = await callTool(client, "apply_submit", {
          ...validApplication,
          mlhEmails: false,
        });
        expect(result.isError).toBe(true);
        expect(firstText(result)).toMatch(/receiving emails from MLH/i);

        const rows = await db
          .select()
          .from(hackerApplicants)
          .where(eq(hackerApplicants.userId, userId));
        expect(rows).toHaveLength(0);
      } finally {
        await client.close();
      }
    });

    it("apply_status reflects a submitted application", async () => {
      const submitClient = await connectClient(accessToken);
      try {
        await callTool(submitClient, "apply_submit", validApplication);
      } finally {
        await submitClient.close();
      }

      const statusClient = await connectClient(accessToken);
      try {
        const result = await callTool(statusClient, "apply_status", {});
        const body = JSON.parse(firstText(result));
        expect(body.hasApplication).toBe(true);
        expect(body.status).toBe("pending");
      } finally {
        await statusClient.close();
      }
    });
  },
);
