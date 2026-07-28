"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { subscribeScroll } from "@/lib/landing/scroll";

interface Options {
  /** Minimum scroll delta before toggling direction. */
  threshold?: number;
  /** Scroll Y after which hide-on-scroll-down activates. */
  minScroll?: number;
}

/**
 * Tracks scroll direction for Mercury-style sticky nav: hide when scrolling
 * down, reveal when scrolling up.
 */
export function useScrollDirection({
  threshold = 8,
  minScroll = 64,
}: Options = {}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const syncFromPosition = () => {
      const y = window.scrollY;
      lastY.current = y;
      setVisible(y < minScroll);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      lastY.current = y;

      if (y < minScroll) {
        setVisible(true);
        return;
      }

      if (Math.abs(delta) < threshold) {
        // Deep links can finish with no final delta — still hide if we're
        // past the hero. Small upward deltas still reveal the bar.
        if (delta < 0) setVisible(true);
        else if (delta > 0) setVisible(false);
        else setVisible(false);
        return;
      }

      if (delta > 0) {
        setVisible(false);
      } else {
        setVisible(true);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const unsubLenis = subscribeScroll(onScroll);
    const id = requestAnimationFrame(syncFromPosition);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
      unsubLenis();
    };
  }, [threshold, minScroll, pathname]);

  return visible;
}
