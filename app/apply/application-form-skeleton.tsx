import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { LIQUID_GLASS_CARD_CLASS } from "@/lib/glass";

export default function ApplicationFormSkeleton() {
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

      <div className="relative z-10 min-h-screen flex flex-col items-center py-8 px-4 sm:px-6">
        {/* Header pill skeleton */}
        <div className="flex items-center justify-between w-full max-w-2xl mb-8">
          <Skeleton className="h-10 w-64 rounded-full bg-white/10" />
          <Skeleton className="h-8 w-16 rounded-full bg-white/10" />
        </div>

        {/* Card skeleton */}
        <div
          className={`w-full max-w-2xl rounded-3xl overflow-hidden ${LIQUID_GLASS_CARD_CLASS}`}
        >
          <div className="px-8 pt-8 pb-6">
            <div className="flex items-start justify-between mb-6">
              <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-10 w-48" />
              </div>
              <Skeleton className="h-16 w-16 rounded-full opacity-30" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>

          <div className="h-px mx-8 bg-[rgba(58,74,38,0.08)]" />

          <div className="px-8 py-7 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
