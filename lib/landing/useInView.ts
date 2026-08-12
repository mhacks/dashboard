"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULTS: IntersectionObserverInit = {
  threshold: 0.2,
  rootMargin: "0px 0px -10% 0px",
};

export function useInView<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  const threshold = options?.threshold ?? DEFAULTS.threshold;
  const rootMargin = options?.rootMargin ?? DEFAULTS.rootMargin;
  const root = options?.root;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin, root },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, root]);

  return { ref, inView };
}
