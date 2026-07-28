"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type CtaVariant = "cta" | "primary" | "parchment" | "cream" | "glass";
type CtaSize = "sm" | "md" | "lg";

const variantMap: Record<
  CtaVariant,
  VariantProps<typeof buttonVariants>["variant"]
> = {
  cta: "cta",
  primary: "cta",
  parchment: "parchment",
  cream: "cream",
  glass: "glass",
};

const sizeMap: Record<CtaSize, VariantProps<typeof buttonVariants>["size"]> = {
  sm: "landing-sm",
  md: "md",
  lg: "landing-lg",
};

interface CtaButtonProps extends Omit<HTMLMotionProps<"a">, "ref"> {
  variant?: CtaVariant;
  size?: CtaSize;
  href?: string;
}

export const CtaButton = forwardRef<HTMLAnchorElement, CtaButtonProps>(
  function CtaButton(
    {
      variant = "primary",
      size = "md",
      className,
      children,
      href = "#",
      ...rest
    },
    ref,
  ) {
    return (
      <motion.a
        href={href}
        ref={ref}
        data-slot="button"
        data-cursor="hover"
        whileTap={{ scale: 0.97 }}
        className={cn(
          buttonVariants({
            variant: variantMap[variant],
            size: sizeMap[size],
          }),
          "inline-flex items-center justify-center font-medium transition-colors",
          className,
        )}
        {...rest}
      >
        {children}
      </motion.a>
    );
  },
);
