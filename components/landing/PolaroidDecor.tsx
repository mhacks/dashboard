"use client";

import { motion } from "framer-motion";
import { AsciiCanvas } from "@/components/landing/AsciiCanvas";
import { asset } from "@/lib/landing/asset";

interface Props {
  src: string;
  caption: string;
  side: "left" | "right";
  initialRotate: number;
  restRotate: number;
  hoverRotate: number;
  delay?: number;
  shadow?: string;
}

/** Decorative polaroid with digitized ASCII overlay — used in About. */
export function PolaroidDecor({
  src,
  caption,
  side,
  initialRotate,
  restRotate,
  hoverRotate,
  delay = 0.25,
  shadow = "0 26px 60px rgba(29,36,18,0.3)",
}: Props) {
  const position =
    side === "right"
      ? "absolute right-[-70px] top-[10%] hidden lg:block"
      : "absolute left-[-70px] top-[12%] hidden lg:block";

  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, y: 24, rotate: initialRotate }}
      whileInView={{ opacity: 1, y: 0, rotate: restRotate }}
      transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay }}
      viewport={{ once: true, amount: 0.4 }}
      className={position}
    >
      <motion.div
        data-cursor="hover"
        whileHover={{
          scale: 1.05,
          rotate: hoverRotate,
          boxShadow: shadow,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        style={{ boxShadow: "0 0 0 rgba(29,36,18,0)" }}
        className="w-[400px] bg-white p-3 pb-4"
      >
        <div className="relative h-[240px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset(src)}
            alt=""
            draggable={false}
            className="h-full w-full scale-[1.06] object-cover blur-[3px]"
          />
          <AsciiCanvas
            className="absolute inset-0"
            step={12}
            fontSize={10}
            opacity={0.65}
          />
        </div>
        <div className="mt-3 text-center font-serif-it text-[17px] text-moss-700">
          {caption}
        </div>
      </motion.div>
    </motion.div>
  );
}
