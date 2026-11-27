import { dictFor, serialise } from '@/lib/crm-i18n';

/** Staff CRM dictionary for one language (te / hi), fetched once by the browser and cached. Contains UI text only. */
export function GET(_: Request, { params }: { params: { lang: string } }) {
  if (params.lang !== 'te' && params.lang !== 'hi') return new Response('Unknown language', { status: 404 });
  return Response.json(serialise(dictFor(params.lang)), {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
