"use client";

import { useEffect, useRef } from "react";

export function BroadcastMessageScroll({
  children,
  scrollKey,
}: {
  children: React.ReactNode;
  scrollKey: string | number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [scrollKey]);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full flex-col justify-end">{children}</div>
    </div>
  );
}
