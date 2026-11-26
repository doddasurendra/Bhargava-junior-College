import { describe, expect, it } from 'vitest';
import { contentBox, otsu, skewAngle, type Gray } from './imagefix';

/** A white page with dark "text lines" tilted by `deg`, written into a sub-rectangle. */
function page(w: number, h: number, deg: number, box = { x: 60, y: 80, w: 260, h: 200 }): Gray {
  const px = new Uint8Array(w * h).fill(235);
  const t = Math.tan((deg * Math.PI) / 180);
  for (let line = 0; line < 8; line++) {
    const y0 = box.y + 15 + line * 22;
    for (let x = box.x; x < box.x + box.w; x++) {
      for (let th = 0; th < 3; th++) {
        const y = Math.round(y0 + (x - box.x) * t) + th;
        if (y >= 0 && y < h && (x % 9) < 7) px[y * w + x] = 30;
      }
    }
  }
  return { w, h, px };
}

describe('scanner image clean-up', () => {
  it('finds the ink threshold and crops to the text area', () => {
    const g = page(400, 400, 0);
    expect(otsu(g)).toBeGreaterThanOrEqual(30);
    expect(otsu(g)).toBeLessThan(235);
    const b = contentBox(g, 0)!;
    expect(b.x).toBeGreaterThanOrEqual(55);
    expect(b.x).toBeLessThanOrEqual(62);
    expect(b.y).toBeGreaterThanOrEqual(90);
    expect(b.x + b.w).toBeLessThanOrEqual(325);
    expect(b.y + b.h).toBeLessThanOrEqual(270);
    expect(contentBox({ w: 50, h: 50, px: new Uint8Array(2500).fill(240) })).toBeNull();
  });

  it('measures the tilt of text lines (deskew)', () => {
    expect(Math.abs(skewAngle(page(400, 400, 0)))).toBeLessThanOrEqual(0.5);
    expect(skewAngle(page(400, 400, 6))).toBeCloseTo(6, 0);
    expect(skewAngle(page(400, 400, -4))).toBeCloseTo(-4, 0);
  });
});
