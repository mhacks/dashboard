"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useMagnetic } from "@/lib/landing/useMagnetic";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type CtaVariant =
  | "cta"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "accent"
  | "cream"
  | "glass"
  | "parchment";

type CtaSize = "sm" | "md" | "lg";

const variantMap: Record<
  CtaVariant,
  VariantProps<typeof buttonVariants>["variant"]
> = {
  cta: "cta",
  primary: "cta",
  secondary: "cream",
  outline: "landing-outline",
  ghost: "landing-ghost",
  accent: "accent",
  cream: "cream",
  glass: "glass",
  parchment: "parchment",
};

const sizeMap: Record<CtaSize, VariantProps<typeof buttonVariants>["size"]> = {
  sm: "landing-sm",
  md: "md",
  lg: "landing-lg",
};

interface CtaButtonProps extends Omit<HTMLMotionProps<"a">, "ref"> {
  variant?: CtaVariant;
  size?: CtaSize;
  magnetic?: boolean;
  href?: string;
}

export const CtaButton = forwardRef<HTMLAnchorElement, CtaButtonProps>(
  function CtaButton(
    {
      variant = "primary",
      size = "md",
      magnetic = false,
      className,
      children,
      href = "#",
      ...rest
    },
    ref,
  ) {
    const magRef = useMagnetic<HTMLAnchorElement>();

    return (
      <motion.a
        href={href}
        ref={magnetic ? magRef : ref}
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

/** @deprecated Use CtaButton */
export const Button = CtaButton;
