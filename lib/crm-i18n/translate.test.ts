import { describe, expect, it } from 'vitest';
import { dictFor, ROWS, translate } from '.';

const te = dictFor('te'), hi = dictFor('hi');

describe('staff CRM dictionary', () => {
  it('every row has Telugu and Hindi in the right script and the same {x} markers', () => {
    for (const [en, t, h] of ROWS) {
      const n = (s: string) => (s.match(/\{x\}/g) ?? []).length;
      expect(t, en).toBeTruthy();
      expect(h, en).toBeTruthy();
      expect(n(t), `te {x} count: ${en}`).toBe(n(en));
      expect(n(h), `hi {x} count: ${en}`).toBe(n(en));
      // real Telugu / Devanagari text (catches encoding damage), unless the row is a brand/code-only string
      if (/[a-z]{3}/.test(en.replace(/\{x\}|WhatsApp|ISBN|Google|NCERT|OpenStax|Excel|CSV|PDF|Supabase|pgvector|Claude|UTC|OCR|API/g, ''))) {
        expect(/[ఀ-౿]/.test(t), `Telugu script: ${en}`).toBe(true);
        expect(/[ऀ-ॿ]/.test(h), `Devanagari script: ${en}`).toBe(true);
      }
      expect(t).not.toMatch(/Ã|â€|à°/); // mojibake
    }
  });
  it('has no conflicting duplicate keys', () => {
    const seen = new Map<string, string>();
    for (const [en, t] of ROWS) {
      const k = en.replace(/\s+/g, ' ').trim();
      if (seen.has(k)) expect(seen.get(k), `duplicate with different Telugu: ${k}`).toBe(t);
      seen.set(k, t);
    }
  });
});

describe('translate()', () => {
  it('exact matches, whitespace-insensitive', () => {
    expect(translate(te, 'Save')).toBe('సేవ్ చేయి');
    expect(translate(hi, '  Save  ')).toBe('सहेजें');
  });
  it('fills {x} patterns and translates the captured part when known', () => {
    expect(translate(te, 'Waiting for approval (3)')).toBe('ఆమోదం కోసం వేచి ఉన్నవి (3)');
    expect(translate(hi, 'Attendance · Physics')).toBe('उपस्थिति · भौतिक विज्ञान');
    expect(translate(hi, 'Chat inbox (12)')).toBe('चैट इनबॉक्स (12)');
  });
  it('translates " · " pieces and "Label: value" independently', () => {
    expect(translate(te, 'Approved · Physics · 12 pages')).toContain('ఆమోదించబడింది · భౌతిక శాస్త్రం');
    expect(translate(hi, 'Status: Pending')).toBe('स्थिति: लंबित');
  });
  it('leaves unknown text, identifiers and numbers alone', () => {
    expect(translate(te, 'ob.manage')).toBeNull();
    expect(translate(te, '2026-27')).toBeNull();
    expect(translate(te, 'Some sentence nobody wrote down')).toBeNull();
  });
});
