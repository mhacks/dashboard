"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const IMAGES = ["/c_pic1.jpg", "/c_pic2.jpg", "/c_pic3.jpg"];

// Visual offset for each stack position (0 = top, increasing = deeper in stack).
// Cards rotate counter-clockwise (negative deg) so the top-left corner rises
// above the card in front, creating a visible gap at the top-left edge.
const STACK = [
  { x: 0, y: 0, rotate: 0, z: 30 },
  { x: 0, y: 6, rotate: -7, z: 20 },
  { x: 0, y: 12, rotate: -14, z: 10 },
];

// Front card = darkest (#3A4A26), each deeper card progressively lighter
const CARD_COLORS = ["#3A4A26", "#7A9A4E", "#C4D98E"];

export default function PhotoCarousel() {
  const [order, setOrder] = useState([0, 1, 2]);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setExiting(true);
      setTimeout(() => {
        setOrder((prev) => {
          const [top, ...rest] = prev;
          return [...rest, top];
        });
        setExiting(false);
      }, 480);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-80 w-[28rem] pb-6 pr-6">
      {order.map((imgIdx, pos) => {
        const isTop = pos === 0;
        const s = STACK[pos] ?? STACK[STACK.length - 1];
        const cardColor =
          CARD_COLORS[pos] ?? CARD_COLORS[CARD_COLORS.length - 1];

        return (
          <div
            key={imgIdx}
            className="absolute"
            style={{
              zIndex: s.z,
              transform:
                isTop && exiting
                  ? "translateY(-115%) translateX(24px) rotate(12deg)"
                  : `translateX(${s.x}px) translateY(${s.y}px) rotate(${s.rotate}deg)`,
              opacity: isTop && exiting ? 0 : 1,
              transition:
                isTop && exiting
                  ? "transform 0.48s ease-in, opacity 0.48s ease-in"
                  : "transform 0.35s ease-out",
            }}
          >
            {/* Card bg — peeks out 8px around the image on all sides */}
            <div
              className="rounded-2xl p-[3px] shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
              style={{ backgroundColor: cardColor }}
            >
              <div className="relative h-72 w-[28rem] overflow-hidden rounded-xl">
                <Image
                  src={IMAGES[imgIdx]}
                  alt={`MHacks photo ${imgIdx + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
