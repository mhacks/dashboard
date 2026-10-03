"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const DEFAULT_CELL_PX = 40;
const MIN_CELL_PX = 20;
const MAX_CELL_PX = 160;
const PAN_THRESHOLD_PX = 4;

type ZoomAnchor = {
  ratioX: number;
  ratioY: number;
  localX: number;
  localY: number;
};

type PanSession = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
};

function isMapControl(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, [data-floor-table]"))
  );
}

export function MapViewport({
  children,
  onBackgroundClick,
}: {
  children: ReactNode;
  onBackgroundClick?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<PanSession | null>(null);
  const pinchRef = useRef<{ distance: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pendingZoomRef = useRef<ZoomAnchor | null>(null);
  const [cellSize, setCellSize] = useState(DEFAULT_CELL_PX);

  function applyZoom(clientX: number, clientY: number, factor: number) {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content || !Number.isFinite(factor) || factor === 1) return;
    const contentRect = content.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    if (contentRect.width <= 0 || contentRect.height <= 0) return;
    const anchor = {
      ratioX: (clientX - contentRect.left) / contentRect.width,
      ratioY: (clientY - contentRect.top) / contentRect.height,
      localX: clientX - frameRect.left,
      localY: clientY - frameRect.top,
    };
    setCellSize((current) => {
      const next = Math.min(
        MAX_CELL_PX,
        Math.max(MIN_CELL_PX, current * factor),
      );
      pendingZoomRef.current = next === current ? null : anchor;
      return next;
    });
  }

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    const pending = pendingZoomRef.current;
    if (!frame || !content || !pending) return;
    const contentRect = content.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const anchorX = contentRect.left + pending.ratioX * contentRect.width;
    const anchorY = contentRect.top + pending.ratioY * contentRect.height;
    frame.scrollLeft += anchorX - (frameRect.left + pending.localX);
    frame.scrollTop += anchorY - (frameRect.top + pending.localY);
    pendingZoomRef.current = null;
  }, [cellSize]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      applyZoom(event.clientX, event.clientY, factor);
    }
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  function pinchDistance() {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return null;
    const [first, second] = points;
    if (!first || !second) return null;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isMapControl(event.target)) return;
    const frame = frameRef.current;
    if (!frame) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    frame.setPointerCapture(event.pointerId);
    if (pointersRef.current.size >= 2) {
      panRef.current = null;
      pinchRef.current = { distance: pinchDistance() ?? 0 };
      return;
    }
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: frame.scrollLeft,
      scrollTop: frame.scrollTop,
      moved: false,
    };
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const distance = pinchDistance();
    if (
      distance !== null &&
      pinchRef.current &&
      pinchRef.current.distance > 0
    ) {
      const factor = distance / pinchRef.current.distance;
      pinchRef.current = { distance };
      const points = [...pointersRef.current.values()];
      const first = points[0];
      const second = points[1];
      if (!first || !second) return;
      applyZoom((first.x + second.x) / 2, (first.y + second.y) / 2, factor);
      return;
    }
    const pan = panRef.current;
    const frame = frameRef.current;
    if (!pan || !frame || pan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pan.startX;
    const deltaY = event.clientY - pan.startY;
    if (!pan.moved && Math.hypot(deltaX, deltaY) < PAN_THRESHOLD_PX) return;
    pan.moved = true;
    frame.scrollLeft = pan.scrollLeft - deltaX;
    frame.scrollTop = pan.scrollTop - deltaY;
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    const wasPan = panRef.current?.pointerId === event.pointerId;
    const moved = panRef.current?.moved ?? false;
    if (wasPan) panRef.current = null;
    pointersRef.current.delete(event.pointerId);
    pinchRef.current =
      pointersRef.current.size >= 2 ? { distance: pinchDistance() ?? 0 } : null;
    if (!wasPan || moved || event.button !== 0) return;
    onBackgroundClick?.();
  }

  return (
    <div
      ref={frameRef}
      onPointerDown={beginPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      className="h-[min(70vh,40rem)] touch-none overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 sm:p-8"
      style={{ "--cell": `${cellSize}px` } as CSSProperties}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
