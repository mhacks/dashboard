"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { MHacksLogo } from "@/components/mhacks-logo";
import { logout } from "@/lib/actions/auth.server.actions";
import { clearStoredPendingRsvp } from "./use-rsvp-autosave";

export function RsvpPageShell({
  accountId,
  onBeforeLogout,
  status,
  children,
}: {
  accountId?: string;
  onBeforeLogout?: () => void;
  status?: ReactNode;
  children: ReactNode;
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="fixed inset-0">
        <Image
          src="/hero_bg_w_overlay.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <Image
        src="/yellow_flower.png"
        alt=""
        width={340}
        height={340}
        className="pointer-events-none absolute -top-10 -left-20 hidden rotate-[-18deg] opacity-[0.16] select-none md:block"
      />
      <Image
        src="/pink_ascii_flower.png"
        alt=""
        width={260}
        height={260}
        className="pointer-events-none absolute right-[-3rem] bottom-8 hidden rotate-[-10deg] opacity-[0.14] select-none md:block"
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 sm:mb-8">
          <div className="glass-pill flex items-center gap-3 rounded-full px-4 py-2.5 sm:px-5">
            <Link
              href="/"
              aria-label="Back to home"
              className="transition-opacity hover:opacity-80"
            >
              <MHacksLogo size={20} />
            </Link>
            <span className="font-heading text-[17px] leading-none italic text-white">
              MHacks 2026
            </span>
            <span className="text-white/25">|</span>
            <span className="font-red-hat text-xs text-white/55">RSVP</span>
          </div>
          <div className="flex items-center gap-2">
            {status}
            <button
              type="button"
              disabled={isSigningOut}
              onClick={async () => {
                setIsSigningOut(true);
                onBeforeLogout?.();
                if (accountId) clearStoredPendingRsvp(accountId);
                await logout();
              }}
              className="glass-pill rounded-full px-4 py-2 font-red-hat text-[11px] font-semibold tracking-widest text-white/55 uppercase transition-colors hover:text-white/80 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </header>
        {children}
        <div className="h-10 shrink-0" />
      </div>
    </div>
  );
}
