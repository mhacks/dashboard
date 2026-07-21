"use client";

import { useCallback, useEffect, useRef } from "react";

export function useCoalescedAsync<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<void>,
) {
  const handlerRef = useRef(handler);
  const stateRef = useRef({
    inFlight: false,
    pendingArgs: null as TArgs | null,
  });

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  return useCallback((...args: TArgs) => {
    const run = async (runArgs: TArgs) => {
      if (stateRef.current.inFlight) {
        stateRef.current.pendingArgs = runArgs;
        return;
      }

      stateRef.current.inFlight = true;
      try {
        await handlerRef.current(...runArgs);
      } finally {
        stateRef.current.inFlight = false;
        const pendingArgs = stateRef.current.pendingArgs;
        if (pendingArgs) {
          stateRef.current.pendingArgs = null;
          void run(pendingArgs);
        }
      }
    };

    void run(args);
  }, []);
}
