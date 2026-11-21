import { NextResponse } from 'next/server';
import { downloadFile } from '@/lib/kb/files';
import { currentViewer } from '@/lib/kb/viewer';

export const dynamic = 'force-dynamic';

/**
 * The only way a Knowledge Hub file leaves storage: resolves the viewer (staff, app profile or public),
 * checks access level + sensitivity, picks the version this viewer may get, watermarks confidential PDFs
 * and audits the download. Not found and not allowed look the same.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const v = await currentViewer();
  const version = Number(url.searchParams.get('v')) || undefined;
  const r = await downloadFile(v, params.id, version);
  if (!r) return new NextResponse('Not found', { status: 404 });
  const inline = url.searchParams.get('inline') === '1' && (r.mime === 'application/pdf' || r.mime.startsWith('image/'));
  const safeName = r.name.replace(/[^\w.\- ]+/g, '_');
  return new NextResponse(Buffer.from(r.bytes), {
    headers: {
      'content-type': r.mime,
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      // non-PDF files can't run anything in our origin even if opened inline (Chrome's PDF viewer refuses
      // sandboxed frames, so PDFs rely on the upload scan that blocks PDF JavaScript)
      ...(r.mime === 'application/pdf' ? {} : { 'content-security-policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
