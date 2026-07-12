// Automated end-to-end test of the MCP OAuth flow — entirely over HTTP,
// no browser needed. Covers mcp-testing-plan.md rungs 0-3: smoke tests,
// client registration, and the full PKCE + OTP + consent + token-exchange
// handshake, then real tool calls against the running MCP server.
//
// Local only — registers a real OAuth client and drives a real OTP login
// against whatever NEXT_PUBLIC_SUPABASE_URL points at, so this refuses to
// run against anything that isn't 127.0.0.1/localhost.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=<from `pnpm supabase status`> \
//     node --env-file=.env.local scripts/test-mcp-oauth-flow.mjs
//
// See agents/mcp-validation-plan.md for the request-shape research this
// was built from, and agents/mcp-testing-plan.md for the manual/browser
// equivalent of what this automates.
//
// Re-running quickly/repeatedly (e.g. while iterating on this script) can
// hit Supabase's own OTP rate limit — a 429 on "trigger OTP" is that, not
// a script bug. Space out reruns, or bump [auth.rate_limit].email_sent /
// use a fresh TEST_EMAIL if you need to iterate fast.

import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "mcp-oauth-test@example.com";

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(SUPABASE_URL)) {
  console.error(
    `Refusing to run: NEXT_PUBLIC_SUPABASE_URL ("${SUPABASE_URL}") doesn't look local.`,
  );
  process.exit(1);
}
if (!PUBLISHABLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Get it from `pnpm supabase status` " +
      '("service_role key") — see agents/mcp-local-dev-runbook.md.',
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function step(name, fn) {
  process.stdout.write(`… ${name}`);
  try {
    const result = await fn();
    process.stdout.write(`\r✓ ${name}\n`);
    passed++;
    return result;
  } catch (err) {
    process.stdout.write(`\r✗ ${name}\n`);
    console.error(`  ${err instanceof Error ? err.message : err}`);
    failed++;
    throw err;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// Template-literal args are evaluated eagerly even when the condition
// passes, so `assert(res.ok, ...await res.text()...)` consumes the body
// on every call, not just failures — breaking a later res.json(). This
// only reads the body when the check actually fails.
async function assertOk(res, label) {
  if (!res.ok) {
    throw new Error(
      `${label}: expected 2xx, got ${res.status}: ${await res.text()}`,
    );
  }
}

function b64url(buf) {
  return buf.toString("base64url");
}

function newPkcePair() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

async function authorize(clientId, redirectUri, challenge, state) {
  const url = new URL(`${SUPABASE_URL}/auth/v1/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  const res = await fetch(url, { redirect: "manual" });
  assert(res.status === 302, `expected 302 from /authorize, got ${res.status}`);
  const location = res.headers.get("location");
  assert(
    location?.includes("/oauth/consent"),
    `unexpected redirect: ${location}`,
  );
  return new URL(location).searchParams.get("authorization_id");
}

async function main() {
  // --- §0/§1: preflight + smoke tests ---
  await step("dev server reachable", async () => {
    const res = await fetch(`${APP_URL}/`);
    assert(res.ok, `expected 200, got ${res.status}`);
  });

  await step("local Supabase reachable", async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`);
    assert(res.ok, `expected 200, got ${res.status}`);
  });

  await step("protected-resource metadata is public JSON", async () => {
    const res = await fetch(`${APP_URL}/.well-known/oauth-protected-resource`);
    assert(res.ok, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(
      Array.isArray(body.authorization_servers),
      "missing authorization_servers",
    );
  });

  await step("Supabase AS discovery doc reachable", async () => {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/.well-known/oauth-authorization-server`,
    );
    assert(res.ok, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.authorization_endpoint, "missing authorization_endpoint");
  });

  await step(
    "unauthenticated MCP call returns 401 + WWW-Authenticate",
    async () => {
      const res = await fetch(`${APP_URL}/api/mcp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      });
      assert(res.status === 401, `expected 401, got ${res.status}`);
      assert(
        res.headers.get("www-authenticate")?.includes("resource_metadata"),
        "missing resource_metadata in WWW-Authenticate header",
      );
    },
  );

  // --- §2: register a fresh test client ---
  const client = await step("register test OAuth client", async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/oauth/clients`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_name: `Automated test ${new Date().toISOString()}`,
        redirect_uris: ["http://127.0.0.1:9999/test-callback"],
        token_endpoint_auth_method: "none",
      }),
    });
    await assertOk(res, "register client");
    return res.json();
  });
  const redirectUri = "http://127.0.0.1:9999/test-callback";

  // --- §3: full OAuth handshake, entirely over HTTP ---
  //
  // OTP login happens BEFORE the PKCE authorize call. Authorization
  // records have a short server-side TTL — doing the multi-step OTP dance
  // (trigger, poll Mailpit, verify) *after* creating one risks it expiring
  // before consent, which 404s with "authorization not found" rather than
  // a clearer expiry error. Establishing the user session first and
  // approving immediately after authorize avoids that. See
  // agents/mcp-validation-plan.md for how this was diagnosed.
  await step("trigger OTP", async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, create_user: true }),
    });
    assert(res.ok, `expected 200, got ${res.status}`);
  });

  const otp = await step("fetch OTP from Mailpit", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=5`);
      const { messages } = await res.json();
      const msg = messages.find((m) =>
        m.To.some((t) => t.Address === TEST_EMAIL),
      );
      const match = msg?.Snippet.match(/(\d{6})/);
      if (match) return match[1];
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("OTP email never arrived in Mailpit");
  });

  const userSession = await step("verify OTP", async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, token: otp, type: "email" }),
    });
    await assertOk(res, "verify OTP");
    return res.json();
  });

  const { verifier, challenge } = newPkcePair();

  const authorizationId = await step("PKCE authorize", () =>
    authorize(client.client_id, redirectUri, challenge, "test-state"),
  );

  const code = await step("approve authorization", async () => {
    // GET the authorization before POSTing consent — empirically required
    // on this Supabase version, not just defensive. Skipping straight to
    // POST .../consent 404s with "authorization not found" even when
    // called immediately after a fresh /authorize call with a valid user
    // token; GET-then-POST works reliably every time. Root cause unknown
    // (likely a read-through/materialization quirk in the local OAuth
    // server beta) — documented here since it cost real debugging time,
    // see agents/mcp-validation-plan.md.
    const getRes = await fetch(
      `${SUPABASE_URL}/auth/v1/oauth/authorizations/${authorizationId}`,
      {
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${userSession.access_token}`,
        },
      },
    );
    await assertOk(getRes, "get authorization details");

    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/oauth/authorizations/${authorizationId}/consent`,
      {
        method: "POST",
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${userSession.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "approve" }),
      },
    );
    await assertOk(res, "approve authorization");
    const { redirect_url } = await res.json();
    return new URL(redirect_url).searchParams.get("code");
  });

  const mcpToken = await step("token exchange", async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/oauth/token`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: client.client_id,
        redirect_uri: redirectUri,
      }),
    });
    await assertOk(res, "token exchange");
    return (await res.json()).access_token;
  });

  async function mcpCall(method, params, id) {
    const res = await fetch(`${APP_URL}/api/mcp/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mcpToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
    });
    const text = await res.text();
    assert(res.ok, `expected 200, got ${res.status}: ${text}`);
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    const payload = JSON.parse((dataLine ?? text).replace(/^data: /, ""));
    assert(!payload.error, `MCP error: ${JSON.stringify(payload.error)}`);
    return payload.result;
  }

  await step("MCP initialize", () =>
    mcpCall(
      "initialize",
      {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-mcp-oauth-flow", version: "1.0" },
      },
      1,
    ),
  );

  await step("tools/list has all apply_* tools", async () => {
    const result = await mcpCall("tools/list", {}, 2);
    const names = result.tools.map((t) => t.name);
    for (const t of [
      "apply_get_schema",
      "apply_get_draft",
      "apply_save_draft",
      "apply_submit",
      "apply_status",
      "apply_get_resume_upload_url",
    ]) {
      assert(names.includes(t), `missing tool: ${t}`);
    }
  });

  await step("apply_status returns a valid shape", async () => {
    const result = await mcpCall(
      "tools/call",
      { name: "apply_status", arguments: {} },
      3,
    );
    const body = JSON.parse(result.content[0].text);
    assert(
      typeof body.hasApplication === "boolean",
      "hasApplication missing or wrong type",
    );
  });

  // Reconnect should skip explicit re-approval — GET on the authorization
  // for an already-consented client returns the redirect (with a fresh
  // code) directly, not the full detail object that would need an
  // Approve call. This is the same short-circuit
  // app/oauth/consent/page.tsx relies on for the browser flow.
  await step(
    "reconnect skips consent (OAuthRedirect short-circuit)",
    async () => {
      const { challenge: challenge2 } = newPkcePair();
      const authId2 = await authorize(
        client.client_id,
        redirectUri,
        challenge2,
        "reconnect-state",
      );
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/oauth/authorizations/${authId2}`,
        {
          headers: {
            apikey: PUBLISHABLE_KEY,
            Authorization: `Bearer ${userSession.access_token}`,
          },
        },
      );
      assert(res.ok, `expected 200, got ${res.status}`);
      const details = await res.json();
      assert(
        details.redirect_url,
        "expected an immediate redirect_url (already consented) — got the full detail object, meaning consent was NOT skipped",
      );
    },
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(1);
});
