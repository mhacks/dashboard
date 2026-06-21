"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOtp } from "@/lib/actions/auth.server.actions";

const RATE_LIMIT_MS = 60_000;
const STORAGE_KEY = "mhacks-otp-last-sent";

interface OtpRecord {
  timestamp: number;
  email: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lastSent, setLastSent] = useState<OtpRecord | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;
    try {
      const record: OtpRecord = JSON.parse(stored);
      const elapsed = Date.now() - record.timestamp;
      return elapsed < RATE_LIMIT_MS
        ? Math.ceil((RATE_LIMIT_MS - elapsed) / 1000)
        : 0;
    } catch {
      return 0;
    }
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeLeft]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (timeLeft > 0) return;
    setError(null);
    setLoading(true);
    const result = await sendOtp(email);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    const record: OtpRecord = { timestamp: Date.now(), email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    setLastSent(record);
    setTimeLeft(60);
    router.push(
      `/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }

  const inCooldown = timeLeft > 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f4f2e8]">
      <Card className="w-full max-w-sm bg-[#faf9f4] border-[#c8d4a8]">
        <CardHeader className="flex flex-col items-center pb-2">
          <MHacksLogo size={48} />
          <p
            className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-center"
            style={{ color: "rgba(58,74,38,0.5)" }}
          >
            MHacks 2026
          </p>
          <h1
            className="mt-2 font-heading italic text-4xl tracking-tight text-center"
            style={{ color: "#3A4A26" }}
          >
            Sign in
          </h1>
          <p
            className="mt-2 text-[13px] text-center"
            style={{ color: "rgba(58,74,38,0.6)" }}
          >
            Enter your email to receive a one-time code.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="email"
                className="text-[12px] font-medium uppercase tracking-widest"
                style={{ color: "rgba(58,74,38,0.6)" }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="bg-white border-[#c8d4a8] focus-visible:ring-[#3A4A26] text-[14px] h-11"
              />
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            {lastSent && (
              <p
                className="text-[12px]"
                style={{ color: "rgba(58,74,38,0.55)" }}
              >
                {inCooldown ? (
                  <>
                    Code sent to{" "}
                    <span className="font-medium">{lastSent.email}</span> at{" "}
                    {formatTime(new Date(lastSent.timestamp))}. Resend in{" "}
                    <span className="font-medium tabular-nums">
                      {timeLeft}s
                    </span>
                  </>
                ) : (
                  <>
                    Last code sent to{" "}
                    <span className="font-medium">{lastSent.email}</span> at{" "}
                    {formatTime(new Date(lastSent.timestamp))}.
                  </>
                )}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || inCooldown}
              className="h-11 rounded-full text-[14px] font-medium cursor-pointer"
              style={{ background: "#3A4A26", color: "#fff" }}
            >
              {loading
                ? "Sending…"
                : inCooldown
                  ? `Resend in ${timeLeft}s`
                  : "Send code"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
