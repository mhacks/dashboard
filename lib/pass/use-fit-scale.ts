import { useEffect, useRef, useState } from "react";

/**
 * Scales a fixed-size node down to fit its container.
 *
 * The ticket is laid out at a fixed 900×340 in real px and only ever *scaled*
 * for display, so a) nothing inside it reflows at different viewport widths and
 * b) the exporter can rasterize the unscaled node and get exactly what is on
 * screen.
 *
 * `max` caps the scale — the mobile layout uses it to hold the preview at 70%.
 */
export function useFitScale(width: number, max = 1) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(max);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (available: number) => {
      if (available <= 0) return;
      setScale(Math.min(max, available / width));
    };

    measure(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      measure(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, max]);

  return { ref, scale };
}
