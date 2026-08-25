"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

import { MHacksLogo } from "@/components/mhacks-logo";
import { logout } from "@/lib/actions/auth.server.actions";

const EASE = [0.25, 0.1, 0.25, 1] as const;

export function RsvpPageShell({
  onBeforeLogout,
  status,
  stepCount,
  children,
}: {
  onBeforeLogout?: () => void;
  status?: ReactNode;
  stepCount?: {
    current: number;
    total: number;
  };
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

      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-10 -left-20 hidden rotate-[-18deg] opacity-[0.18] select-none md:block"
      >
        <Image src="/yellow_flower.png" alt="" width={360} height={360} />
      </motion.div>
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
        className="pointer-events-none absolute top-24 -right-20 hidden rotate-12 opacity-[0.14] select-none md:block"
      >
        <Image src="/pink_flower.png" alt="" width={300} height={300} />
      </motion.div>
      <motion.div
        animate={{ y: [0, -9, 0] }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8,
        }}
        className="pointer-events-none absolute bottom-28 -left-16 hidden rotate-[8deg] opacity-[0.14] select-none md:block"
      >
        <Image src="/light_blue_flower.png" alt="" width={280} height={280} />
      </motion.div>
      <motion.div
        animate={{ y: [0, -11, 0] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2.2,
        }}
        className="pointer-events-none absolute right-[-3.5rem] bottom-6 hidden rotate-[-10deg] opacity-[0.14] select-none md:block"
      >
        <Image src="/pink_ascii_flower.png" alt="" width={240} height={240} />
      </motion.div>

      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 py-6 sm:px-6 sm:py-8">
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-8 flex w-full max-w-2xl items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="glass-pill flex items-center gap-3 rounded-full px-3 py-2.5 sm:px-5">
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
            </div>
            <Link
              href="/dashboard"
              className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-2 font-red-hat text-[11px] font-semibold tracking-widest text-white/55 uppercase transition-colors hover:text-white/80 sm:px-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {status}
            {stepCount && (
              <div className="glass-pill rounded-full px-4 py-2">
                <span className="font-red-hat text-[11px] font-semibold tracking-widest text-white/55 uppercase">
                  {stepCount.current} / {stepCount.total}
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={isSigningOut}
              onClick={async () => {
                setIsSigningOut(true);
                onBeforeLogout?.();
                await logout();
              }}
              className="glass-pill rounded-full px-4 py-2 font-red-hat text-[11px] font-semibold tracking-widest text-white/55 uppercase transition-colors hover:text-white/80 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </motion.header>
        {children}
        <div className="h-10 shrink-0" />
      </div>
    </div>
  );
}
