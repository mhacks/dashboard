"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  handleMarketingNavClick,
  isMarketingHome,
  resolveMarketingHref,
} from "@/lib/landing/nav";
import { asset } from "@/lib/landing/asset";

interface Props {
  size?: number;
  className?: string;
  imageClassName?: string;
  href?: string;
  priority?: boolean;
}

export function Logo({
  size = 44,
  className,
  imageClassName,
  href = "#top",
  priority = false,
}: Props) {
  const onHome = isMarketingHome(usePathname());
  const img = (
    <Image
      src={asset("/logos/mhacks-logo.png")}
      alt="MHacks"
      width={size}
      height={size}
      priority={priority}
      className={cn("h-full w-full object-contain", imageClassName)}
    />
  );

  if (!href) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {img}
      </span>
    );
  }

  return (
    <Link
      href={resolveMarketingHref(href, onHome)}
      aria-label="MHacks home"
      data-cursor="hover"
      onClick={(e) => handleMarketingNavClick(href, onHome, e)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {img}
    </Link>
  );
}
