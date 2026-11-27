import { canTeach, readFile } from '@/lib/openbook/core';
import { obBooks, obCards, obPapers, obPosts, obQuestions } from '@/lib/openbook/collections';
import { store } from '@/lib/openbook/core';
import { whoIsAsking } from '@/lib/openbook/session';

export const dynamic = 'force-dynamic';

/**
 * Open Book files, private storage only — every request is access-checked here:
 *  book:     approved book with a stored file (licence allowed storing it); download only if downloadAllowed
 *  paper:    approved paper (any signed-in student/staff), or the uploader / staff for pending ones; original file unchanged
 *  solution: as paper
 *  scan:     the student who scanned it (or teaching staff)
 *  post:     community image, any signed-in student/staff
 *  card:     a diagram flashcard's image, its owner only
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get('k');
  const id = url.searchParams.get('id') ?? '';
  const download = url.searchParams.get('download') === '1';
  const { studentId, staff } = await whoIsAsking();
  if (!studentId && !staff) return new Response('Sign in first.', { status: 401 });
  let key: string | null = null;
  let name = 'file';
  let mime = 'application/octet-stream';
  let mayDownload = false;
  if (kind === 'book') {
    const b = await obBooks.get(store(), id);
    if (!b?.data.fileKey || (b.data.status !== 'approved' && !(staff && canTeach(staff)) && b.data.uploadedBy.id !== studentId)) return new Response('Not found', { status: 404 });
    key = b.data.fileKey; name = b.data.fileName ?? `${b.data.title}.pdf`; mime = /\.docx$/i.test(name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : /\.pptx$/i.test(name) ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf';
    mayDownload = b.data.downloadAllowed || !!(staff && canTeach(staff)); // staff manage the college's documents
  } else if (kind === 'paper' || kind === 'solution') {
    const p = await obPapers.get(store(), id);
    if (!p || (p.data.status !== 'approved' && !(staff && canTeach(staff)) && p.data.uploadedBy.id !== studentId)) return new Response('Not found', { status: 404 });
    key = kind === 'paper' ? p.data.fileKey : p.data.solutionKey;
    name = kind === 'paper' ? p.data.fileName : `${p.data.title} - solutions`;
    mime = kind === 'paper' ? p.data.mime : 'application/pdf';
    mayDownload = true;
  } else if (kind === 'scan') {
    const q = await obQuestions.get(store(), id);
    if (!q?.data.imageKey || (q.data.ownerId !== studentId && !(staff && canTeach(staff)))) return new Response('Not found', { status: 404 });
    key = q.data.imageKey; mime = 'image/jpeg'; name = 'scan.jpg';
  } else if (kind === 'card') {
    const c = await obCards.get(store(), id);
    if (!c?.data.imageKey || c.data.studentId !== studentId) return new Response('Not found', { status: 404 });
    key = c.data.imageKey; mime = 'image/jpeg'; name = 'diagram.jpg';
  } else if (kind === 'post') {
    const p = await obPosts.get(store(), id);
    if (!p?.data.imageKey || (p.data.hidden && !staff)) return new Response('Not found', { status: 404 });
    key = p.data.imageKey; mime = 'image/jpeg'; name = 'image.jpg';
  }
  if (!key) return new Response('Not found', { status: 404 });
  if (download && !mayDownload) return new Response('This book can be read in the app but not downloaded (licence).', { status: 403 });
  const bytes = await readFile(key);
  if (!bytes) return new Response('Not found', { status: 404 });
  const sniffed = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x25 ? 'application/pdf' : mime;
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': sniffed, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name.replace(/[^\w .-]/g, '_').slice(0, 120)}"`,
    },
  });
}
