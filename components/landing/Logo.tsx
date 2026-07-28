"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { scrollToHash } from "@/lib/landing/scroll";
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
      href={href}
      aria-label="MHacks home"
      data-cursor="hover"
      onClick={(e) => {
        if (href.startsWith("#")) {
          e.preventDefault();
          scrollToHash(href);
        }
      }}
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
