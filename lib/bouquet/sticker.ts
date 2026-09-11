import { SCENE, flowerById, vaseById } from "./catalog";
import { getImage, loadAssets } from "./images";
import { arrangementBounds, stemGeometry, type PlacedStem } from "./geometry";

const INK = "#463328";

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** stems then vase, in scene coordinates — mirrors the DOM layout transform */
function drawArrangement(
  ctx: CanvasRenderingContext2D,
  stems: PlacedStem[],
  order: string[],
  vaseId: string,
) {
  const vase = vaseById(vaseId);
  for (const uid of order) {
    const s = stems.find((x) => x.uid === uid);
    if (!s) continue;
    const f = flowerById(s.flowerId);
    const img = getImage(f.id);
    if (!img) continue;
    const g = stemGeometry(s, vase);
    ctx.save();
    ctx.translate(g.ax, g.ay);
    ctx.rotate((s.rotation * Math.PI) / 180);
    if (s.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -f.anchorX * g.w, -g.h, g.w, g.h);
    ctx.restore();
  }
  const vimg = getImage(vase.id);
  if (!vimg) return;
  const vh = vase.height;
  const vw = vh * vase.ratio;
  ctx.drawImage(
    vimg,
    SCENE.width / 2 - vase.centreX * vw,
    SCENE.vaseBaseY - vh,
    vw,
    vh,
  );
}

/* Dilate the art's alpha and flood it with one colour — the sticker's die-cut
   allowance. Stamping the bitmap around two rings approximates the Minkowski
   sum with a disc closely enough at these radii. */
function stampRing(
  ctx: CanvasRenderingContext2D,
  art: HTMLCanvasElement,
  r: number,
  colour: string,
) {
  const m = newCanvas(art.width, art.height);
  const mc = m.getContext("2d");
  if (!mc) return;
  const N = 44;
  for (const ring of [r, r * 0.5]) {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      mc.drawImage(art, Math.cos(a) * ring, Math.sin(a) * ring);
    }
  }
  mc.globalCompositeOperation = "source-in";
  mc.fillStyle = colour;
  mc.fillRect(0, 0, m.width, m.height);
  ctx.drawImage(m, 0, 0);
}

export async function renderSticker(
  stems: PlacedStem[],
  order: string[],
  vaseId: string,
  borderColor: string,
  scale: number,
): Promise<HTMLCanvasElement> {
  await loadAssets();

  const b = arrangementBounds(stems, vaseId);
  const allowance = 15;
  const pad = 26; // must exceed allowance + hairline or the dilation clips
  const w = (b.right - b.left + pad * 2) * scale;
  const h = (SCENE.vaseBaseY - b.top + pad * 2) * scale;

  const art = newCanvas(w, h);
  const actx = art.getContext("2d")!;
  actx.scale(scale, scale);
  actx.translate(-b.left + pad, -b.top + pad);
  drawArrangement(actx, stems, order, vaseId);

  const out = newCanvas(w, h);
  const octx = out.getContext("2d")!;
  // the hairline stays ink whatever the border colour — every option is
  // near-white and needs an outer edge to read against a light surface
  stampRing(octx, art, (allowance + 2.2) * scale, INK);
  stampRing(octx, art, allowance * scale, borderColor);
  octx.drawImage(art, 0, 0);
  return out;
}

export function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => cv.toBlob(res, "image/png"));
}
