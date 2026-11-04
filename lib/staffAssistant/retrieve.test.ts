import { describe, expect, it } from 'vitest';
import { parseQuery } from './parse';
import { search, terms, type Doc } from './retrieve';

const doc = (id: string, title: string, text: string, source: Doc['source'] = 'notice'): Doc => ({ id, source, title, text, date: '2026-11-01', href: null });

describe('notes and circulars retrieval', () => {
  it('parses note-search questions', () => {
    expect(parseQuery('notes about fees')).toEqual({ kind: 'notes', q: 'fees' });
    expect(parseQuery('search circulars on PTM schedule')).toEqual({ kind: 'notes', q: 'PTM schedule' });
    expect(parseQuery('mentor notes for exam stress')).toEqual({ kind: 'notes', q: 'exam stress' });
    expect(parseQuery('policy on mobile phones')).toEqual({ kind: 'notes', q: 'mobile phones' });
    expect(parseQuery('BJC-2027-JEE-0001').kind).toBe('lookup'); // unchanged
  });

  it('stems lightly and drops stop words', () => {
    expect(terms('The fees and Notes')).toEqual(['fee', 'note']);
    expect(terms('missing classes')).toEqual(['miss', 'classe']);
  });

  it('ranks the most relevant documents first and returns nothing for unrelated queries', () => {
    const docs = [
      doc('1', 'Second term fee instalment', 'The second fee instalment is due on 10 December. Pay online or at the accounts office.'),
      doc('2', 'PTM on Saturday', 'Parent-teacher meeting for JEE batches on Saturday 9 AM.'),
      doc('3', 'Mentor call', 'Parent worried about fees and hostel food; explained the instalment plan.', 'mentor_note'),
      doc('4', 'Sports day', 'Annual sports day on 20 December.'),
    ];
    const hits = search(docs, 'fee instalment');
    expect(hits.map((h) => h.id)).toEqual(['1', '3']);
    expect(hits[0].snippet).toMatch(/fee instalment/i);
    expect(search(docs, 'chemistry olympiad')).toEqual([]);
    expect(search([], 'fees')).toEqual([]);
  });
});
