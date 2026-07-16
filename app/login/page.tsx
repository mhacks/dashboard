"use client";

import { useState, useRef, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
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
import posthog from "posthog-js";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const tokenSchema = z.object({
  token: z.string().length(6, "Code must be 6 digits"),
});

type EmailForm = z.infer<typeof emailSchema>;
type TokenForm = z.infer<typeof tokenSchema>;

const SLOT_CLASS =
  "size-11 font-red-hat text-base border-[#c8d4a8] data-[active=true]:border-[#3A4A26] data-[active=true]:ring-[#3A4A26]/30";

function AuthForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [step, setStep] = useState<"email" | "verify">("email");
  const [sentEmail, setSentEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const tokenForm = useForm<TokenForm>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { token: "" },
  });

  // react-hook-form's watch() cannot be memoized by React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const tokenValue = tokenForm.watch("token");

  async function onSendOtp({ email }: EmailForm) {
    if (!turnstileToken) {
      emailForm.setError("email", {
        message: "Please complete the security check.",
      });
      return;
    }
    const result = await sendOtp(email, turnstileToken);
    if (result?.error) {
      emailForm.setError("email", { message: result.error });
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      return;
    }
    posthog.capture("otp_requested");
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
    emailForm.reset();
    setTurnstileToken(null);
  }

  const sharedHeader = (
    <>
      <div className="mt-2">
        <MHacksLogo size={48} variant="green" />
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <Image
        src="/mhacks_auth_pink_flower.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      <Card className="relative z-10 w-full max-w-sm bg-[#faf9f4] border-[#c8d4a8]">
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
                className="mt-2 font-red-hat text-[13px] text-center"
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
                    className="bg-white border-[#c8d4a8] focus-visible:ring-[#3A4A26] font-red-hat text-[14px] h-11"
                    {...emailForm.register("email")}
                  />
                  {emailForm.formState.errors.email && (
                    <p className="font-red-hat text-[13px] text-red-600">
                      {emailForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Turnstile
                  ref={turnstileRef}
                  className="ph-no-capture"
                  siteKey={process.env.NEXT_PUBLIC_LOGIN_TURNSTILE_SITE_KEY!}
                  options={{ appearance: "interaction-only" }}
                  onSuccess={setTurnstileToken}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />

                <Button
                  type="submit"
                  disabled={emailForm.formState.isSubmitting || !turnstileToken}
                  className="h-11 rounded-full font-red-hat text-[14px] font-medium cursor-pointer"
                  style={{ background: "#3A4A26", color: "#fff" }}
                >
                  {emailForm.formState.isSubmitting ? "Sending…" : "Send code"}
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
                className="mt-2 font-red-hat text-[13px] text-center"
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
                    <p className="font-red-hat text-[13px] text-red-600">
                      {tokenForm.formState.errors.token.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={
                    tokenForm.formState.isSubmitting || tokenValue.length < 6
                  }
                  className="h-11 rounded-full font-red-hat text-[14px] font-medium cursor-pointer"
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
                  className="font-red-hat text-[13px]"
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
