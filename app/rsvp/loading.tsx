import Image from "next/image";

import { Skeleton } from "@/components/ui/skeleton";

export default function RsvpLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Image
        src="/hero_bg_w_overlay.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 py-8 sm:px-6">
        <div className="mb-8 flex w-full max-w-2xl items-center justify-between">
          <Skeleton className="h-10 w-56 rounded-full bg-white/10" />
          <Skeleton className="h-8 w-20 rounded-full bg-white/10" />
        </div>
        <div className="glass-card w-full max-w-2xl rounded-3xl px-5 py-8 sm:px-8">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-12 w-4/5" />
          <Skeleton className="mt-4 h-16 w-full" />
          <Skeleton className="mt-6 h-8 w-full" />
          <div className="mt-8 flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
