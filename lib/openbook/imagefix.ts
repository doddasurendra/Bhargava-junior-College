/**
 * Scanner image clean-up in the browser (§23), pure functions on a grayscale pixel grid so they are unit
 * tested without a DOM:
 *  - contentBox: auto-crop to the area that contains ink (dark pixels against the paper background)
 *  - skewAngle: deskew by the projection-profile method (text lines give the sharpest row histogram when
 *    the page is level); searches −15°…+15°
 */
export interface Gray { w: number; h: number; px: Uint8Array } // 0 = black … 255 = white

/** Otsu threshold: separates ink from paper whatever the lighting. */
export function otsu(g: Gray) {
  const hist = new Array(256).fill(0);
  for (const v of g.px) hist[v]++;
  const total = g.px.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  return t;
}

/** Bounding box of the ink (ignoring isolated specks and a thin border), with a margin. null if blank. */
export function contentBox(g: Gray, marginPct = 0.03): { x: number; y: number; w: number; h: number } | null {
  const t = Math.min(otsu(g), 200);
  const border = Math.round(Math.min(g.w, g.h) * 0.01);
  const rows = new Array(g.h).fill(0), cols = new Array(g.w).fill(0);
  let ink = 0;
  for (let y = border; y < g.h - border; y++) for (let x = border; x < g.w - border; x++) if (g.px[y * g.w + x] <= t) { rows[y]++; cols[x]++; ink++; }
  if (ink < 20) return null;
  const minRow = Math.max(1, Math.round(g.w * 0.004)), minCol = Math.max(1, Math.round(g.h * 0.004));
  let y0 = rows.findIndex((n) => n >= minRow), y1 = g.h - 1 - [...rows].reverse().findIndex((n) => n >= minRow);
  let x0 = cols.findIndex((n) => n >= minCol), x1 = g.w - 1 - [...cols].reverse().findIndex((n) => n >= minCol);
  if (y0 < 0 || x0 < 0 || y1 <= y0 || x1 <= x0) return null;
  const mx = Math.round(g.w * marginPct), my = Math.round(g.h * marginPct);
  x0 = Math.max(0, x0 - mx); y0 = Math.max(0, y0 - my); x1 = Math.min(g.w - 1, x1 + mx); y1 = Math.min(g.h - 1, y1 + my);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Tilt of the text lines in degrees (positive = lines slope down to the right). Rotate the image by −angle to level it. */
export function skewAngle(g: Gray, maxDeg = 15, step = 0.5): number {
  const t = Math.min(otsu(g), 200);
  const pts: [number, number][] = [];
  const stride = Math.max(1, Math.floor(Math.sqrt((g.w * g.h) / 60000)));
  for (let y = 0; y < g.h; y += stride) for (let x = 0; x < g.w; x += stride) if (g.px[y * g.w + x] <= t) pts.push([x, y]);
  if (pts.length < 50) return 0;
  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a);
    const bins = new Map<number, number>();
    for (const [x, y] of pts) { const r = Math.round((y * c - x * s) / stride); bins.set(r, (bins.get(r) ?? 0) + 1); }
    let v = 0;
    for (const n of bins.values()) v += n * n; // sharper lines → larger sum of squares
    return v;
  };
  let best = 0, bestScore = score(0);
  for (let d = -maxDeg; d <= maxDeg + 1e-9; d += step) { const sc = score(d); if (sc > bestScore * 1.0001) { bestScore = sc; best = d; } }
  return Math.round(best * 10) / 10;
}
