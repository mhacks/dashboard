import { useMediaQuery } from "@/hooks/use-media-query";

const MOBILE_BREAKPOINT = 768;

/**
 * Tracks whether the viewport is below the mobile breakpoint.
 *
 * Was a second, near-identical copy of useMediaQuery — the shadcn-vendored
 * version, which additionally read window.innerWidth in its useState
 * initializer. use-media-query.ts documents why that is a problem: Next
 * prerenders client components on the server, where there is no window.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
