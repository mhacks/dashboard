"use client";

import { useEffect, useState } from "react";

const APPLICATIONS_OPEN_AT = new Date("2026-06-22T15:00:00-04:00").getTime();

export function useApplicationsOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const updateOpen = () => setOpen(Date.now() >= APPLICATIONS_OPEN_AT);

    updateOpen();
    const intervalId = window.setInterval(updateOpen, 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return open;
}
