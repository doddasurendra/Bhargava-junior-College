import { expect, test } from '@playwright/test';

/** Live: the voice assistant answers with Gemini (not the knowledge-base fallback) in English, Telugu and Hindi. */
test.skip(process.env.QA_RUN_AI !== '1', 'Set QA_RUN_AI=1 (makes real, billed AI calls)');
test.setTimeout(3 * 60_000);

for (const [lang, text] of [
  ['en', 'What programs does Bhargava Junior College offer?'],
  ['te', 'కాలేజీలో హాస్టల్ సౌకర్యం ఉందా?'],
  ['hi', 'एडमिशन के लिए कौन से दस्तावेज़ चाहिए?'],
] as const) {
  test(`voice answer (${lang})`, async ({ request }) => {
    const r = await request.post('/api/voice/turn', { data: { text, lang } });
    const j = await r.json();
    const d = j.data ?? j;
    console.log(`voice ${lang}:`, r.status(), 'fallback=', d.fallback, '|', String(d.caption ?? j.error ?? '').replace(/\s+/g, ' ').slice(0, 260));
    expect(r.status()).toBe(200);
    expect(d.fallback).toBe(false);
    expect(String(d.speech ?? '').length).toBeGreaterThan(10);
  });
}
