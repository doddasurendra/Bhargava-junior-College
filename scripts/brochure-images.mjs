// Converts the official brochure photos to WebP for the website.
// Usage: node scripts/brochure-images.mjs [source folder]   (default: assets/brochure-images)
// - copies the originals into assets/brochure-images/ (kept in the repo, not served)
// - writes resized WebP files to public/images/brochure/<section>/<name>.webp
// - writes content/brochure/images.json with each image's width and height (for next/image)
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const KEEP = join(ROOT, 'assets', 'brochure-images');
const OUT = join(ROOT, 'public', 'images', 'brochure');
const SRC = resolve(process.argv[2] ?? KEEP);

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const files = walk(SRC).filter((f) => /\.(jpe?g|png)$/i.test(f));
if (!files.length) throw new Error(`No images found in ${SRC}`);

const manifest = {};
for (const f of files.sort()) {
  const rel = relative(SRC, f).replace(/\\/g, '/');
  const section = rel.split('/')[0];
  const name = basename(f, extname(f));
  if (SRC !== KEEP) {
    mkdirSync(join(KEEP, section), { recursive: true });
    copyFileSync(f, join(KEEP, rel));
  }
  // hero images may be shown full-width; everything else at most 1600 px wide
  const max = section === 'hero' ? 1920 : 1600;
  const out = join(OUT, section, `${name}.webp`);
  mkdirSync(join(OUT, section), { recursive: true });
  const info = await sharp(f).rotate().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, alphaQuality: 90 }).toFile(out);
  manifest[`${section}/${name}`] = { src: `/images/brochure/${section}/${name}.webp`, w: info.width, h: info.height };
  console.log(`${rel} -> ${relative(ROOT, out)} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
}
// The printed QR opens the home page; the site shows its own QR that opens the brochure PDF directly.
const QRCode = (await import('qrcode')).default;
mkdirSync(join(OUT, 'contact'), { recursive: true });
await QRCode.toFile(join(OUT, 'contact', 'brochure-qr.png'), 'https://www.bhargavajuniorcollege.com/docs/BJC-Brochure-2027-28.pdf', { width: 420, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1f2a5a', light: '#ffffff' } });

mkdirSync(join(ROOT, 'content', 'brochure'), { recursive: true });
writeFileSync(join(ROOT, 'content', 'brochure', 'images.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${files.length} images. Manifest: content/brochure/images.json${existsSync(KEEP) ? '' : ''}`);
