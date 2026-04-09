import { NextResponse } from "next/server";

/** Must match mhacks-auth RegisterDto */
const REGISTER_ROLES = ["hacker", "judge", "organizer"] as const;
type RegisterRole = (typeof REGISTER_ROLES)[number];

/**
 * Proxies registration to mhacks-auth so the browser avoids cross-origin calls.
 * Set AUTH_API_URL server-side (e.g. http://localhost:3000) — do not use NEXT_PUBLIC_.
 */
export async function POST(request: Request) {
  const base = process.env.AUTH_API_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { message: "Server misconfiguration: AUTH_API_URL is not set" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Invalid body" }, { status: 400 });
  }

  const { email, name, role } = body as Record<string, unknown>;

  if (typeof email !== "string" || typeof name !== "string" || typeof role !== "string") {
    return NextResponse.json(
      { message: "name, email, and role must be strings" },
      { status: 400 },
    );
  }

  if (!REGISTER_ROLES.includes(role as RegisterRole)) {
    return NextResponse.json(
      { message: "role must be hacker, judge, or organizer" },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, role }),
  });

  const text = await upstream.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Unknown error from auth service" };
  }

  return NextResponse.json(data, { status: upstream.status });
}
