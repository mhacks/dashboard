"use client";

import { useEffect, useState } from "react";

/**
 * "hero" while the scroll position is above the hero's midpoint, "page" once
 * it passes halfway through the hero. Deterministic single boundary — the
 * frosted nav bar is on for everything below that midpoint, and the
 * transparent hero variant is guaranteed by the time you're back at the top.
 */
export function useNavTheme(fraction = 0.5): "hero" | "page" {
  const [zone, setZone] = useState<"hero" | "page">("hero");

  useEffect(() => {
    const hero = document.getElementById("top");

    const update = () => {
      if (!hero) {
        setZone("page");
        return;
      }
      // The hero is sticky-pinned under the page stack, so its bounding rect
      // never moves once pinned — judge by scroll position against its flow
      // height instead.
      setZone(window.scrollY < hero.offsetHeight * fraction ? "hero" : "page");
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [fraction]);

  return zone;
}
