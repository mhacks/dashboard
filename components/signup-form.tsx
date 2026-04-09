"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type RegisterRole = "hacker" | "judge" | "organizer";

const ROLES: { value: RegisterRole; label: string }[] = [
  { value: "hacker", label: "Hacker" },
  { value: "judge", label: "Judge" },
  { value: "organizer", label: "Organizer" },
];

function formatApiMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const msg = (data as { message?: unknown }).message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg) && msg.every((m) => typeof m === "string")) {
    return msg.join(" ");
  }
  return null;
}

export function SignupForm({ className }: { className?: string }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<RegisterRole>("hacker");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiMessage(data) || `Request failed (${res.status})`);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Is the dashboard server running?");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We created your account and sent a one-time code to{" "}
            <span className="font-medium text-foreground">{email}</span>. Use
            that code in the next step to finish signing in (verification UI
            coming soon).
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t-0 bg-transparent pt-0">
          <p className="text-muted-foreground text-xs">
            Didn&apos;t get a code? After email delivery is connected, you can
            request a new one from the login flow.
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader>
        <CardTitle>Create your MHacks account</CardTitle>
        <CardDescription>
          Sign up with your email. You&apos;ll verify with a one-time code
          before accessing the rest of the app.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="signup-name">Full name</Label>
            <Input
              id="signup-name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              aria-invalid={!!error}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              aria-invalid={!!error}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signup-role">Role</Label>
            <select
              id="signup-role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as RegisterRole)}
              className={cn(
                "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "dark:bg-input/30",
              )}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
