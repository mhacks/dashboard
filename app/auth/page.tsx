"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { sendOtp, verifyOtp } from "@/lib/actions/auth.server.actions";

const RATE_LIMIT_MS = 60_000;
const STORAGE_KEY = "mhacks-otp-last-sent";

interface OtpRecord {
  timestamp: number;
  email: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const tokenSchema = z.object({
  token: z.string().length(6, "Code must be 6 digits"),
});

type EmailForm = z.infer<typeof emailSchema>;
type TokenForm = z.infer<typeof tokenSchema>;

const SLOT_CLASS =
  "size-11 text-base border-[#c8d4a8] data-[active=true]:border-[#3A4A26] data-[active=true]:ring-[#3A4A26]/30";

function AuthForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [step, setStep] = useState<"email" | "verify">("email");
  const [sentEmail, setSentEmail] = useState("");

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

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const tokenForm = useForm<TokenForm>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { token: "" },
  });

  const tokenValue = tokenForm.watch("token");

  async function onSendOtp({ email }: EmailForm) {
    if (timeLeft > 0) return;
    const result = await sendOtp(email);
    if (result?.error) {
      emailForm.setError("email", { message: result.error });
      return;
    }
    const record: OtpRecord = { timestamp: Date.now(), email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    setLastSent(record);
    setTimeLeft(60);
    setSentEmail(email);
    setStep("verify");
  }

  async function onVerifyOtp({ token }: TokenForm) {
    const result = await verifyOtp(sentEmail, token, next);
    if (result?.error) {
      tokenForm.setError("token", { message: result.error });
    }
  }

  function goBack() {
    setStep("email");
    tokenForm.reset();
  }

  const inCooldown = timeLeft > 0;

  const sharedHeader = (
    <>
      <MHacksLogo size={48} />
      <p
        className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-center"
        style={{ color: "rgba(58,74,38,0.5)" }}
      >
        MHacks 2026
      </p>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f4f2e8]">
      <Card className="w-full max-w-sm bg-[#faf9f4] border-[#c8d4a8]">
        {step === "email" ? (
          <>
            <CardHeader className="flex flex-col items-center pb-2">
              {sharedHeader}
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
              <form
                onSubmit={emailForm.handleSubmit(onSendOtp)}
                className="flex flex-col gap-4"
              >
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
                    autoFocus
                    className="bg-white border-[#c8d4a8] focus-visible:ring-[#3A4A26] text-[14px] h-11"
                    {...emailForm.register("email")}
                  />
                  {emailForm.formState.errors.email && (
                    <p className="text-[13px] text-red-600">
                      {emailForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

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
                  disabled={emailForm.formState.isSubmitting || inCooldown}
                  className="h-11 rounded-full text-[14px] font-medium cursor-pointer"
                  style={{ background: "#3A4A26", color: "#fff" }}
                >
                  {emailForm.formState.isSubmitting
                    ? "Sending…"
                    : inCooldown
                      ? `Resend in ${timeLeft}s`
                      : "Send code"}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="flex flex-col items-center pb-2">
              {sharedHeader}
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
                  {sentEmail}
                </span>
              </p>
            </CardHeader>

            <CardContent>
              <form
                onSubmit={tokenForm.handleSubmit(onVerifyOtp)}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col items-center gap-2">
                  <Controller
                    name="token"
                    control={tokenForm.control}
                    render={({ field }) => (
                      <InputOTP
                        maxLength={6}
                        value={field.value}
                        onChange={field.onChange}
                        autoFocus
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className={SLOT_CLASS} />
                          <InputOTPSlot index={1} className={SLOT_CLASS} />
                          <InputOTPSlot index={2} className={SLOT_CLASS} />
                          <InputOTPSlot index={3} className={SLOT_CLASS} />
                          <InputOTPSlot index={4} className={SLOT_CLASS} />
                          <InputOTPSlot index={5} className={SLOT_CLASS} />
                        </InputOTPGroup>
                      </InputOTP>
                    )}
                  />
                  {tokenForm.formState.errors.token && (
                    <p className="text-[13px] text-red-600">
                      {tokenForm.formState.errors.token.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={
                    tokenForm.formState.isSubmitting || tokenValue.length < 6
                  }
                  className="h-11 rounded-full text-[14px] font-medium cursor-pointer"
                  style={{ background: "#3A4A26", color: "#fff" }}
                >
                  {tokenForm.formState.isSubmitting
                    ? "Verifying…"
                    : "Verify code"}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  onClick={goBack}
                  className="text-[13px]"
                  style={{ color: "rgba(58,74,38,0.55)" }}
                >
                  Use a different email
                </Button>
              </form>
            </CardContent>
          </>
        )}
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
