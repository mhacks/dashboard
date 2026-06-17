"use client"

import { useEffect, useRef } from 'react'

// deterministic 2D hash → [0,1), used to scatter + vary the flowers
function hash(x: number, y: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// a small ascii flower: a center dot ringed by inner petals and outer tips,
// all drawn as little squares to keep the dotted-glyph aesthetic
function drawFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rot: number,
  alpha: number,
  color: string,
) {
  const dot = Math.max(2, Math.round(r / 5))
  const tip = Math.max(1, dot - 1)
  ctx.fillStyle = `rgba(${color}, ${alpha})`
  // center
  ctx.fillRect(cx - dot / 2, cy - dot / 2, dot, dot)
  const petals = 6
  for (let p = 0; p < petals; p++) {
    const a = rot + (p / petals) * Math.PI * 2
    const ix = cx + Math.cos(a) * r * 0.55
    const iy = cy + Math.sin(a) * r * 0.55
    ctx.fillRect(ix - dot / 2, iy - dot / 2, dot, dot)
    const ox = cx + Math.cos(a) * r
    const oy = cy + Math.sin(a) * r
    ctx.fillRect(ox - tip / 2, oy - tip / 2, tip, tip)
  }
}

/** Ascii flowers scattered down the left and right gutters, leaving the center
 *  column clear for text and cards. The field parallaxes with the page and the
 *  blooms gently rotate/swell as you scroll, so it reacts to scroll site-wide.
 *  Sits at -z-10 so it paints over the paper background but behind content. */
export default function AsciiBackground({
  gap = 74,
  color = '58, 74, 38', // moss rgb channels — alpha is computed per flower
}: {
  gap?: number
  color?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let scrollY = window.scrollY
    let dpr = 1

    const draw = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // clear central band for content; flowers live in the side gutters
      const clear = Math.min(w - 64, 940)
      const gutter = Math.max(0, (w - clear) / 2)
      if (gutter < 8) return

      const cols = Math.ceil(w / gap) + 2
      const startRow = Math.floor(scrollY / gap) - 1
      const endRow = Math.ceil((scrollY + h) / gap) + 1

      for (let gy = startRow; gy <= endRow; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          if (hash(gx, gy) < 0.42) continue
          const seed = hash(gx, gy)
          const jx = (hash(gx + 31, gy + 7) - 0.5) * gap * 0.6
          const jy = (hash(gx + 5, gy + 53) - 0.5) * gap * 0.6
          const x = gx * gap + jx
          const worldY = gy * gap + jy
          const y = worldY - scrollY
          if (y < -gap || y > h + gap) continue

          // only keep flowers inside the side gutters, fading toward center
          const distFromEdge = Math.min(x, w - x)
          if (distFromEdge > gutter) continue
          const edge = Math.max(0, Math.min(1, 1 - distFromEdge / gutter))

          // scroll-driven bloom: blossoms swell + brighten in a travelling wave
          const wave =
            Math.sin(worldY / 220 - gx * 0.4 - scrollY / 360) * 0.5 + 0.5
          const r = gap * (0.24 + seed * 0.16) * (0.8 + wave * 0.4)
          const alpha = (0.22 + edge * 0.48) * (0.65 + wave * 0.35)
          const rot = seed * Math.PI * 2 + scrollY / 1200

          drawFlower(ctx, x, y, r, rot, alpha, color)
        }
      }
    }

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      draw()
    }

    const onScroll = () => {
      scrollY = window.scrollY
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [gap, color])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  )
}
