import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  getSignedEmailPreference,
  maskEmailAddress,
} from "@/lib/email/preferences";
import { confirmEmailUnsubscribe } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Email preferences | MHacks",
  robots: { index: false, follow: false },
};

export default async function EmailUnsubscribePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const result = singleValue(params.result);
  const id = singleValue(params.id);
  const signature = singleValue(params.sig);
  const preference =
    id && signature ? await getSignedEmailPreference(id, signature) : null;

  const state = result === "unsubscribed" ? "unsubscribed" : result;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <Image
        src="/mhacks_blue_auth_bg.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25"
      />
      <Card className="relative z-10 w-full max-w-md border-[#c8d4a8] bg-[#faf9f4]/95 shadow-[0_24px_64px_-24px_rgba(31,42,22,0.55)] backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center pb-2">
          <MHacksLogo size={48} variant="green" />
          <h1 className="mt-2 text-center font-heading text-4xl italic tracking-tight text-[#3A4A26]">
            Email preferences
          </h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-center font-red-hat text-[#3A4A26]">
          {state === "unsubscribed" ? (
            <>
              <p>You&apos;re unsubscribed from optional MHacks updates.</p>
              <p className="text-[13px] text-[#3A4A26]/65">
                You may still receive required messages about your application,
                RSVP, travel, or account.
              </p>
            </>
          ) : state === "invalid" || !preference ? (
            <>
              <p>This unsubscribe link is invalid.</p>
              <p className="text-[13px] text-[#3A4A26]/65">
                Sign in to view and update your email preferences instead.
              </p>
            </>
          ) : preference.status === "unsubscribed" ? (
            <>
              <p>
                {maskEmailAddress(preference.email)} is already unsubscribed
                from optional MHacks updates.
              </p>
              <p className="text-[13px] text-[#3A4A26]/65">
                Sign in if you want to subscribe again.
              </p>
            </>
          ) : (
            <>
              <p>
                Stop optional MHacks updates to{" "}
                {maskEmailAddress(preference.email)}?
              </p>
              <p className="text-[13px] text-[#3A4A26]/65">
                Required messages about your application, RSVP, travel, or
                account are not affected.
              </p>
              <form action={confirmEmailUnsubscribe}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="signature" value={signature} />
                <Button type="submit" variant="cta">
                  Unsubscribe
                </Button>
              </form>
            </>
          )}

          <Button asChild variant="link">
            <Link href="/account/email-preferences">
              Manage preferences in your account
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function singleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}
