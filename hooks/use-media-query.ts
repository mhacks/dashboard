import { useEffect, useState } from "react";

/**
 * Tracks a media query.
 *
 * Starts `false` rather than reading `window` up front: Next prerenders client
 * components on the server, where there is no `window`, so touching it in the
 * initializer breaks the build. The real value lands in the effect on the
 * first client pass.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
