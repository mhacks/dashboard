"use client";

import { useCallback, useMemo, useRef } from "react";
import { SCENE, flowerById, vaseById } from "@/lib/bouquet/catalog";
import {
  bloomPoint,
  stemCorners,
  stemGeometry,
  type PlacedStem,
} from "@/lib/bouquet/geometry";
import { hitTest } from "@/lib/bouquet/hitTest";

type Props = {
  bouquet: PlacedStem[];
  order: string[];
  vaseId: string;
  selectedUid: string | null;
  hoveredUid: string | null;
  wrapped: boolean;
  onSelect: (uid: string | null) => void;
  onHover: (uid: string | null) => void;
  children?: React.ReactNode; // overlays (wrap button, export panel)
};

export default function Scene({
  bouquet,
  order,
  vaseId,
  selectedUid,
  hoveredUid,
  wrapped,
  onSelect,
  onHover,
  children,
}: Props) {
  const canvasRef = useRef<HTMLElement>(null);
  const arrangeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(false);

  const vase = vaseById(vaseId);
  const vaseH = vase.height;
  const vaseW = vaseH * vase.ratio;

  /** pointer position → scene coordinates, independent of the stage scale */
  const toScene = useCallback((e: React.MouseEvent) => {
    const el = arrangeRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const scale = r.width / SCENE.width;
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (wrapped) return;
      if ((e.target as HTMLElement).closest(".overlays > *")) return;
      const p = toScene(e);
      if (!p) return;
      const hit = hitTest(bouquet, order, vaseId, p.x, p.y);
      onSelect(hit ? hit.uid : null);
    },
    [wrapped, toScene, bouquet, order, vaseId, onSelect],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      if (wrapped || rafRef.current) return;
      rafRef.current = true;
      const p = toScene(e);
      requestAnimationFrame(() => {
        rafRef.current = false;
        if (!p) return;
        const hit = hitTest(bouquet, order, vaseId, p.x, p.y);
        onHover(hit ? hit.uid : null);
      });
    },
    [wrapped, toScene, bouquet, order, vaseId, onHover],
  );

  // label follows the selected stem, else whatever is hovered
  const labelled = useMemo(() => {
    const uid = selectedUid ?? hoveredUid;
    if (!uid || wrapped) return null;
    const stem = bouquet.find((s) => s.uid === uid);
    if (!stem) return null;
    const g = stemGeometry(stem, vase);
    // y: the genuinely highest corner, so the pill never covers artwork.
    // x: the art's top-edge midpoint — that is where the bloom sits. Using
    // the highest *corner* for both threw the pill out to the side on
    // steeply rotated stems.
    const topY = Math.min(...stemCorners(stem, g).map((c) => c[1]));
    const headX = bloomPoint(stem, g)[0];
    return {
      name: flowerById(stem.flowerId).name,
      left: Math.min(SCENE.width - 80, Math.max(80, headX)),
      top: Math.max(34, topY - 24),
    };
  }, [selectedUid, hoveredUid, wrapped, bouquet, vase]);

  const cursor = !wrapped && hoveredUid ? "pointer" : "default";

  return (
    <section
      id="canvas"
      ref={canvasRef}
      style={{ cursor }}
      onClick={handleClick}
      onMouseMove={handleMove}
      onMouseLeave={() => onHover(null)}
    >
      <div className="bg">
        <div className="band wall" />
        <div className="band tiles" />
        <div className="band table" />
        {/* wall decor: inside .bg so it renders behind the stems and stays on
            the wall rather than travelling with the arrangement */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="wall-plaque"
          src="/assets/scene/plaque-mflower.png"
          alt="MFlower"
        />
      </div>

      <div className="arrangement" ref={arrangeRef}>
        <div className="stems">
          {order.map((uid, depth) => {
            const stem = bouquet.find((s) => s.uid === uid);
            if (!stem) return null;
            const f = flowerById(stem.flowerId);
            const g = stemGeometry(stem, vase);
            const cls =
              "stem" +
              (stem.uid === selectedUid
                ? " selected"
                : stem.uid === hoveredUid
                  ? " hovered"
                  : "");
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={uid}
                className={cls}
                src={f.asset}
                alt={f.name}
                draggable={false}
                style={{
                  width: g.w,
                  height: g.h,
                  left: g.ax - f.anchorX * g.w,
                  top: g.ay - g.h,
                  transformOrigin: `${f.anchorX * 100}% 100%`,
                  transform: `rotate(${stem.rotation}deg)${stem.flip ? " scaleX(-1)" : ""}`,
                  zIndex: depth + 1,
                }}
              />
            );
          })}
        </div>

        {/* contact shadow — the vase stands out on the table rather than
            meeting the seam, so without one it reads as floating */}
        <div
          className="vase-shadow"
          style={{
            width: vaseW * 0.88,
            left: SCENE.width / 2 - (vaseW * 0.88) / 2,
            top: SCENE.vaseBaseY - 15,
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="vase"
          src={vase.asset}
          alt={vase.name}
          draggable={false}
          style={{
            width: vaseW,
            height: vaseH,
            left: SCENE.width / 2 - vase.centreX * vaseW,
            top: SCENE.vaseBaseY - vaseH,
          }}
        />

        {labelled && (
          <div
            className="label"
            style={{ left: labelled.left, top: labelled.top }}
          >
            {labelled.name}
          </div>
        )}
      </div>

      <div className="overlays">{children}</div>
    </section>
  );
}
