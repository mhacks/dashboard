"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/** Hide only when a flower intrudes this many px into the text column */
function flowerBlocksContent(
  flower: DOMRect,
  content: DOMRect,
  side: "left" | "right",
  intrusion = 48,
) {
  if (side === "left") {
    return flower.right > content.left + intrusion;
  }
  return flower.left < content.right - intrusion;
}

export default function AboutFlowers({
  contentRef,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  const checkOverlap = useCallback(() => {
    const content = contentRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!content || !left || !right) return;

    if (window.innerWidth < 640) {
      setVisible(false);
      return;
    }

    const contentRect = content.getBoundingClientRect();
    const blocked =
      flowerBlocksContent(left.getBoundingClientRect(), contentRect, "left") ||
      flowerBlocksContent(right.getBoundingClientRect(), contentRect, "right");

    setVisible(!blocked);
  }, [contentRef]);

  useEffect(() => {
    const run = () => requestAnimationFrame(checkOverlap);
    run();
    window.addEventListener("resize", run);

    const content = contentRef.current;
    const observer =
      content &&
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(run)
        : null;
    if (content && observer) observer.observe(content);

    return () => {
      window.removeEventListener("resize", run);
      observer?.disconnect();
    };
  }, [checkOverlap, contentRef]);

  return (
    <>
      <div
        ref={leftRef}
        className={`pointer-events-none absolute bottom-0 -left-10 z-[1] hidden origin-bottom-left transition-opacity duration-300 sm:block lg:-left-16 ${visible ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!visible}
      >
        <Image
          src="/pixel_flowers_green.png"
          alt=""
          width={442}
          height={782}
          onLoad={checkOverlap}
          className="h-auto w-[min(24vw,220px)] max-w-none rotate-[33deg] select-none sm:w-[min(22vw,200px)] lg:w-[min(22vw,260px)]"
        />
      </div>
      <div
        ref={rightRef}
        className={`pointer-events-none absolute bottom-0 -right-10 z-[1] hidden origin-bottom-right transition-opacity duration-300 sm:block lg:-right-16 ${visible ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!visible}
      >
        <Image
          src="/pixel_flowers_blue.png"
          alt=""
          width={412}
          height={692}
          onLoad={checkOverlap}
          className="h-auto w-[min(24vw,220px)] max-w-none rotate-[-33deg] select-none sm:w-[min(22vw,200px)] lg:w-[min(22vw,260px)]"
        />
      </div>
    </>
  );
}
