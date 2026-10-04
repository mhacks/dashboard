"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Caret, buttonClass } from "@/components/console/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { redeemHuntCode } from "@/lib/actions/hunt-codes.server.actions";
import { HUNT_CODE_LENGTH, HUNT_PUZZLE_PATH } from "@/lib/hunt/constants";

const HALF = HUNT_CODE_LENGTH / 2;
const SLOT_CLASS =
  "size-11 first:rounded-none last:rounded-none font-red-hat-mono text-lg text-ui-ink border-ui-line-strong data-[active=true]:border-ui-ink data-[active=true]:ring-ui-ink/20";

function Slots({ start }: { start: number }) {
  return Array.from({ length: HALF }, (_, offset) => (
    <InputOTPSlot
      key={start + offset}
      index={start + offset}
      className={SLOT_CLASS}
    />
  ));
}

export function HuntCodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  function submit(value: string) {
    if (value.length !== HUNT_CODE_LENGTH || checking) return;
    setError(null);
    startChecking(async () => {
      const result = await redeemHuntCode(value);
      if (result.ok) {
        router.push(HUNT_PUZZLE_PATH);
        return;
      }
      setError(result.message);
      setCode("");
      // A decoy organizer's code hides the map; show that straight away.
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col items-start gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit(code);
      }}
    >
      <label
        htmlFor="hunt-code"
        className="font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft uppercase"
      >
        Organizer&apos;s code
      </label>
      <InputOTP
        id="hunt-code"
        maxLength={HUNT_CODE_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        pasteTransformer={(pasted) => pasted.replace(/\D/g, "")}
        value={code}
        onChange={setCode}
        onComplete={submit}
        disabled={checking}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "hunt-code-error" : undefined}
      >
        <InputOTPGroup className="rounded-none">
          <Slots start={0} />
        </InputOTPGroup>
        <span aria-hidden className="px-1 text-ui-ink-soft">
          –
        </span>
        <InputOTPGroup className="rounded-none">
          <Slots start={HALF} />
        </InputOTPGroup>
      </InputOTP>
      {error ? (
        <p
          id="hunt-code-error"
          role="alert"
          className="text-sm leading-[1.5] text-ui-ink"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={code.length !== HUNT_CODE_LENGTH || checking}
        className={buttonClass("primary", "disabled:opacity-50")}
      >
        <Caret />
        {checking ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
