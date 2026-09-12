import type { LayoutStorage } from "react-resizable-panels";

/** localStorage adapter for react-resizable-panels; ignores private-mode/quota failures. */
export const panelLayoutStorage: LayoutStorage = {
  getItem(key) {
    try {
      return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  },
};
