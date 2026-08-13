"use client";

import { type RefObject } from "react";
import { useScroll, useTransform, type MotionValue } from "framer-motion";

/** Scroll-linked garland entrance shared by Sponsors, Schedule, and Agent. */
export function useGarlandEntrance(
  ref: RefObject<HTMLElement | null>,
  direction: "left" | "right",
): MotionValue<string> {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  });
  const from = direction === "left" ? "62vw" : "-62vw";
  return useTransform(scrollYProgress, [0.08, 0.92], [from, "0vw"]);
}
