"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyOtp } from "@/lib/actions/auth.server.actions";

function VerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";
  const next = searchParams.get("next") ?? "/";

  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await verifyOtp(email, token, next);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    }
    // On success, verifyOtp calls redirect("/") server-side — navigation happens automatically
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f4f2e8]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
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
            Check your email
          </h1>
          <p
            className="mt-2 text-[13px] text-center"
            style={{ color: "rgba(58,74,38,0.6)" }}
          >
            We sent a 6-digit code to{" "}
            <span className="font-medium" style={{ color: "#3A4A26" }}>
              {email}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="token"
              className="text-[12px] font-medium uppercase tracking-widest"
              style={{ color: "rgba(58,74,38,0.6)" }}
            >
              One-time code
            </Label>
            <Input
              id="token"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={token}
              onChange={(e) =>
                setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
              required
              autoFocus
              className="bg-white border-[#c8d4a8] focus-visible:ring-[#3A4A26] text-[14px] h-11 tracking-[0.4em] font-mono"
            />
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <Button
            type="submit"
            disabled={loading || token.length < 6}
            className="h-11 rounded-full text-[14px] font-medium cursor-pointer"
            style={{ background: "#3A4A26", color: "#fff" }}
          >
            {loading ? "Verifying…" : "Verify code"}
          </Button>

          <button
            type="button"
            onClick={() => router.push("/auth")}
            className="text-[13px] text-center underline-offset-2 hover:underline cursor-pointer"
            style={{ color: "rgba(58,74,38,0.55)" }}
          >
            Use a different email
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
