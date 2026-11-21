// Shrinks a print PDF for the website by re-encoding its large photos (no Ghostscript needed).
// Usage: node scripts/compress-pdf.mjs <in.pdf> <out.pdf> [maxPx=1600] [quality=72]
// Text, vectors and layout are untouched; only image streams are replaced with smaller JPEGs.
// Images with transparency keep their soft mask; images we can't decode safely are left as they are.
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import sharp from 'sharp';

const [, , input, output, maxArg, qArg] = process.argv;
if (!input || !output) throw new Error('Usage: node scripts/compress-pdf.mjs <in.pdf> <out.pdf> [maxPx] [quality]');
const MAX = Number(maxArg ?? 1600);
const QUALITY = Number(qArg ?? 72);

const doc = await PDFDocument.load(readFileSync(input), { updateMetadata: false });
const ctx = doc.context;
const N = PDFName.of;

/** Number of colour channels of an image's colour space, or null if we don't handle it. */
function channels(cs) {
  const v = cs instanceof Object && 'asArray' in cs ? cs.asArray() : null;
  if (cs === N('DeviceRGB')) return 3;
  if (cs === N('DeviceGray')) return 1;
  if (cs === N('DeviceCMYK')) return 4;
  if (v && v[0] === N('ICCBased')) {
    const icc = ctx.lookup(v[1]);
    const n = icc?.dict?.get(N('N'));
    return n instanceof PDFNumber ? n.asNumber() : null;
  }
  return null;
}

let before = 0;
let after = 0;
let changed = 0;
for (const [ref, obj] of [...ctx.enumerateIndirectObjects()]) {
  if (!(obj instanceof PDFRawStream)) continue;
  const d = obj.dict;
  if (d.get(N('Subtype')) !== N('Image')) continue;
  const w = d.get(N('Width'))?.asNumber?.();
  const h = d.get(N('Height'))?.asNumber?.();
  const bpc = d.get(N('BitsPerComponent'))?.asNumber?.();
  const filter = d.get(N('Filter'));
  const ch = channels(d.get(N('ColorSpace')));
  if (!w || !h || bpc !== 8 || !ch || ch === 1 || d.has(N('Decode')) || d.has(N('ImageMask')) || obj.contents.length < 60_000) continue;

  let img;
  if (filter === N('DCTDecode')) {
    img = sharp(Buffer.from(obj.contents));
  } else if (filter === N('FlateDecode') && !d.has(N('DecodeParms'))) {
    const raw = Buffer.from(decodePDFRawStream(obj).decode());
    if (raw.length !== w * h * ch) continue;
    img = sharp(raw, { raw: { width: w, height: h, channels: ch } });
  } else continue;

  const scale = Math.min(1, MAX / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  // CMYK is converted to RGB by sharp, so the colour space becomes DeviceRGB; RGB keeps its ICC profile.
  const jpg = await img.resize(nw, nh).toColourspace('srgb').jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
  if (jpg.length >= obj.contents.length) continue;

  const nd = d.clone(ctx);
  nd.set(N('Filter'), N('DCTDecode'));
  nd.delete(N('DecodeParms'));
  nd.set(N('Width'), PDFNumber.of(nw));
  nd.set(N('Height'), PDFNumber.of(nh));
  nd.set(N('Length'), PDFNumber.of(jpg.length));
  if (ch !== 3) nd.set(N('ColorSpace'), N('DeviceRGB'));
  ctx.assign(ref, PDFRawStream.of(nd, jpg));
  before += obj.contents.length;
  after += jpg.length;
  changed++;
}

const bytes = await doc.save({ useObjectStreams: true });
writeFileSync(output, bytes);
console.log(`re-encoded ${changed} images: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB; file ${(bytes.length / 1048576).toFixed(1)} MB`);
