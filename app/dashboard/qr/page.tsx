import Link from "next/link";
import { redirect } from "next/navigation";

import { KeepAwake } from "@/components/checkin/keep-awake";
import { QrCode } from "@/components/checkin/qr-code";
import { requireSessionUser } from "@/lib/auth/guards";
import { getAttendeeQrEligibility } from "@/lib/queries/check-in";

/**
 * The check-in code, full screen and edge to edge.
 *
 * This exists alongside the dashboard's drawer for three reasons: it is the
 * fallback when the drawer's JavaScript never arrives on venue wifi, a plain
 * white field scans better than a sheet floating over a dimmed overlay, and it
 * is an address a volunteer can say out loud to someone who can't find the
 * button.
 */
export default async function DashboardQrPage() {
  const { id: userId } = await requireSessionUser();

  const eligible = await getAttendeeQrEligibility(userId);

  // Outside any try on purpose: redirect() throws NEXT_REDIRECT and a catch
  // would swallow the navigation. A failed eligibility query degrades to false,
  // which lands here — the safe default for a gated surface is to send someone
  // back rather than hand out a code we could not verify.
  if (!eligible) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-white px-6 py-10">
      <KeepAwake />

      <QrCode
        value={userId}
        label="Your MHacks check-in code"
        className="w-[min(82vw,380px)]"
      />

      <div className="max-w-[34ch] text-center">
        <p className="font-red-hat-mono text-[11px] tracking-[0.18em] text-black uppercase">
          MHacks 2026 check-in
        </p>
        <p className="mt-2 font-red-hat text-[13px] leading-[1.5] text-neutral-600">
          Show this at the door and at meals. Turn your brightness up — and take
          a screenshot, it scans just as well without signal.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="font-red-hat-mono text-[11.5px] tracking-[0.02em] text-neutral-500 underline underline-offset-2 transition-colors hover:text-black"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
