"use client";

import { useEffect } from "react";

/**
 * Shared SVG displacement filter that powers the `.liquid-glass` class.
 * The filter refracts whatever sits behind the element (feTurbulence noise
 * driving a displacement map), which is what sells the "liquid" look.
 *
 * SVG filters inside `backdrop-filter` only render in Chromium, and Safari
 * even parses the value while drawing nothing — so instead of @supports we
 * gate the refraction on an actual Chromium check and tag <html> with
 * `.lg-refract`. Everyone else gets the frosted-glass fallback.
 */
export function LiquidGlassFilter() {
  useEffect(() => {
    const isChromium =
      typeof (window as { chrome?: unknown }).chrome !== "undefined" &&
      CSS.supports("backdrop-filter", "url(#liquid-glass-distortion)");
    if (isChromium) {
      document.documentElement.classList.add("lg-refract");
      return () => document.documentElement.classList.remove("lg-refract");
    }
  }, []);

  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        <filter
          id="liquid-glass-distortion"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          filterUnits="objectBoundingBox"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.02"
            numOctaves="2"
            seed="17"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2.5" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="46"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
