import { describe, expect, it } from 'vitest';
import { defaultContent } from '../cms/blocks';
import { buildCorpus, detectLang, groundedAnswer, indexStatus, NOT_FOUND, retrieve } from './index';

const c = defaultContent();

describe('BJC knowledge base (RAG)', () => {
  it('chunks the verified website content with titles, sections and URLs', () => {
    const chunks = buildCorpus(c);
    expect(chunks.length).toBeGreaterThan(10);
    expect(chunks.every((x) => x.text && x.url.startsWith('/'))).toBe(true);
    expect(chunks.some((x) => x.section.startsWith('Fees') && x.url === '/fees')).toBe(true);
    expect(chunks.some((x) => /Vision:/.test(x.text))).toBe(true);
    expect(chunks.some((x) => x.text.includes('[SAMPLE DATA'))).toBe(false); // markers stripped, flag kept
    expect(indexStatus(c).chunks).toBe(chunks.length);
  });

  it('retrieves the right section for real questions, typos and Telugu/Hindi', () => {
    expect(retrieve(c, 'What is the address of the college?').hits[0]?.section).toBe('Contact and location');
    expect(retrieve(c, 'hostel fees').hits.map((h) => h.section).join(' ')).toMatch(/Hostel|Fees/);
    expect(retrieve(c, 'tell me about the scholarshp test').hits[0]?.section).toMatch(/BSAT/); // typo
    expect(retrieve(c, 'కాలేజీ చిరునామా ఏమిటి?').hits[0]?.section).toBe('Contact and location');
    expect(retrieve(c, 'आपके कॉलेज की फीस कितनी है?').hits.some((h) => /Fees/.test(h.section))).toBe(true);
    expect(retrieve(c, 'What is the vision of the college?').hits[0]?.text).toMatch(/Vision:/);
  });

  it('never guesses: unknown or out-of-scope questions get the verified not-found message in the visitor’s language', () => {
    expect(groundedAnswer(c, 'Who won the cricket world cup?')).toMatchObject({ found: false, text: NOT_FOUND.en });
    expect(groundedAnswer(c, 'క్రికెట్ ప్రపంచ కప్ ఎవరు గెలిచారు?').text).toBe(NOT_FOUND.te);
    expect(detectLang('कौन सा कोर्स')).toBe('hi');
    const a = groundedAnswer(c, 'What are your office hours?');
    expect(a.found).toBe(true);
    expect(a.text).toMatch(/Monday/);
    // cited source is the chunk that actually answered: the "Office hours" KB article or the Contact section
    expect(a.sources.map((s) => s.title).join(' ')).toMatch(/Office hours|Contact and location/);
  });

  it('re-indexes automatically when content changes', () => {
    const before = indexStatus(c).version;
    const c2 = defaultContent();
    c2.knowledgeBase.items.push({ title: 'Uniform policy', body: 'Students wear the college uniform on all working days.', category: 'policies', audience: 'public', published: true });
    expect(indexStatus(c2).version).not.toBe(before);
    expect(retrieve(c2, 'uniform').hits[0]?.title).toBe('Uniform policy');
  });
});
