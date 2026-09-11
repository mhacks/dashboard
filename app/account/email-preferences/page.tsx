import Image from "next/image";
import type { Metadata } from "next";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth/guards";
import { getEmailPreferenceForUser } from "@/lib/email/preferences";
import { updateOptionalEmailPreference } from "./actions";

export const metadata: Metadata = {
  title: "Email preferences | MHacks",
};

export default async function EmailPreferencesPage() {
  const user = await requireSessionUser();
  const preference = await getEmailPreferenceForUser(user);
  const subscribed = preference.status === "subscribed";

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
          <p className="mt-2 text-center font-red-hat text-[13px] text-[#3A4A26]/65">
            {user.email}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 font-red-hat text-[#3A4A26]">
          <div className="rounded-lg border border-[#c8d4a8] p-4">
            <p className="text-[15px] font-semibold">Optional MHacks updates</p>
            <p className="mt-1 text-[13px] leading-5 text-[#3A4A26]/65">
              News, announcements, and promotional updates. Required messages
              about your application, RSVP, travel, or account are not affected.
            </p>
            <p className="mt-3 text-[13px] font-medium">
              Current status: {subscribed ? "Subscribed" : "Unsubscribed"}
            </p>
            <form action={updateOptionalEmailPreference} className="mt-3">
              <input
                type="hidden"
                name="status"
                value={subscribed ? "unsubscribed" : "subscribed"}
              />
              <Button type="submit" variant={subscribed ? "outline" : "cta"}>
                {subscribed ? "Unsubscribe" : "Subscribe again"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
