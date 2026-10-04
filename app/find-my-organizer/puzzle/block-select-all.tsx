"use client";

import { useEffect } from "react";

/**
 * Cancels Ctrl+A / Cmd+A so the hidden text has to be found by dragging or
 * clicking around. The browser's Edit → Select All menu and a phone's
 * long-press "Select all" can't be blocked from a page, so this only makes
 * the puzzle harder, not airtight.
 */
export function BlockSelectAll() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
