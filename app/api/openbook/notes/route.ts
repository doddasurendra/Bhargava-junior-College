import { notesMarkdown } from '@/lib/openbook/library';
import { whoIsAsking } from '@/lib/openbook/session';

export const dynamic = 'force-dynamic';

/** Markdown export of the signed-in student's own highlights and notes. */
export async function GET() {
  const { studentId } = await whoIsAsking();
  if (!studentId) return new Response('Sign in as a student.', { status: 401 });
  return new Response(await notesMarkdown(studentId), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="open-book-notes.md"', 'Cache-Control': 'no-store' } });
}
