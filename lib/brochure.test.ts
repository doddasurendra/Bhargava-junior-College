import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROCHURE, BROCHURE_PDF, FACULTY, media } from '@/content/brochure';
import manifest from '@/content/brochure/images.json';
import { defaultContent } from './cms/blocks';
import { filterData, type MetricsData } from './crm/metrics';
import { groundedAnswer } from './rag';

/** The official 2027-28 brochure content (content/brochure) and where it shows up. */
describe('official brochure content', () => {
  it('has Telugu and Hindi for every English block, item for item', () => {
    const shape = (v: unknown): unknown => (Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v);
    expect(shape(BROCHURE.te)).toEqual(shape(BROCHURE.en));
    expect(shape(BROCHURE.hi)).toEqual(shape(BROCHURE.en));
    // translated, not copied
    expect(BROCHURE.te.cover.title).not.toBe(BROCHURE.en.cover.title);
    expect(BROCHURE.hi.leadership.mission[0]).not.toBe(BROCHURE.en.leadership.mission[0]);
  });

  it('uses the brochure wording', () => {
    const t = BROCHURE.en;
    expect(t.cover.title).toBe('Two Years. One Dream.');
    expect(t.cover.recognised).toBe('Recognised by Govt. of Telangana, College Code: 58560');
    expect(t.different.items).toHaveLength(8);
    expect(t.different.beyond).toHaveLength(4);
    expect(t.parents.items).toHaveLength(6);
    expect(t.evolve.steps.map((s) => s.t[0]).join('')).toBe('EVOLVE');
    expect(t.campusLife.blocks).toHaveLength(6);
    expect(t.campuses.items.map((c) => c.location)).toEqual(['Bairamalguda', 'Kuntloor', 'LB Nagar, Hyderabad']);
  });

  it('lists the 16 professors in 4 groups with their photos', () => {
    expect(FACULTY).toHaveLength(16);
    for (const g of ['maths', 'physics', 'chemistry', 'biology']) expect(FACULTY.filter((f) => f.group === g)).toHaveLength(4);
    expect(FACULTY.find((f) => f.name === 'Prof. Adhi Naryana')?.photo.src).toBe('/images/brochure/faculty/prof-adhi-narayana.webp');
    expect(FACULTY.find((f) => f.name === 'Prof. Kalyan')?.photo.alt).toBe('Prof. Kalyan, Physics, 20+ years experience');
  });

  it('every image it uses exists as WebP, and the PDF is under 10 MB', () => {
    const pub = join(process.cwd(), 'public');
    for (const m of Object.values(manifest)) {
      expect(m.src).toMatch(/\.webp$/);
      expect(existsSync(join(pub, m.src))).toBe(true);
    }
    expect(media.campusLife.flat()).toHaveLength(12);
    expect(statSync(join(pub, BROCHURE_PDF)).size).toBeLessThan(10 * 1024 * 1024);
    expect(existsSync(join(pub, 'images/brochure/contact/brochure-qr.png'))).toBe(true);
  });

  it('replaces the sample faculty, gallery and brochure link; keeps sample badges on fees, results and BSAT', () => {
    const c = defaultContent();
    expect(c.faculty.sample).toBe(false);
    expect(c.faculty.items).toHaveLength(16);
    expect(c.gallery.sample).toBe(false);
    expect(c.gallery.items.length).toBeGreaterThan(40);
    expect(c.brochures.urls['iit-jee']).toBe(BROCHURE_PDF);
    expect(c.faqs.items.slice(0, 6).map((f) => f.q)).toEqual(BROCHURE.en.parents.items.map((i) => i.q));
    expect(c.heroSlides.slides[0].title).toBe('Two Years. One Dream.');
    expect([c.fees.sample, c.results.sample, c.bsat.sample, c.testimonials.sample]).toEqual([true, true, true, true]);
    expect(c.knowledgeBase.items.filter((a) => a.category === 'parents')).toHaveLength(6);
  });

  it('the chatbot answers from the new knowledge-base articles', () => {
    const c = defaultContent();
    const boys = groundedAnswer(c, "Where is the boys' hostel?");
    expect(boys.found).toBe(true);
    expect(boys.text).toMatch(/Kuntloor/);
    const girls = groundedAnswer(c, 'Where is the girls hostel?');
    expect(girls.text).toMatch(/Bairamalguda/);
    const chair = groundedAnswer(c, 'Who is the chairman?');
    expect(chair.text).toMatch(/Venugopal Gattu/);
    const cls = groundedAnswer(c, 'How many students per class?');
    expect(cls.text).toMatch(/40 students/);
  });
});

describe('campus filter on the dashboard', () => {
  it('keeps only the leads that chose the campus', () => {
    const lead = (id: string) => ({ id, program: null, firstSource: 'web', lastSource: 'web', school: null, ownerId: null }) as unknown as MetricsData['leads'][number];
    const data = { leads: [lead('a'), lead('b')], calls: [], audit: [], visits: [], signOffs: [], payments: [], admitted: [], staff: [] } as unknown as MetricsData;
    expect(filterData(data, { campusLeadIds: new Set(['b']) }).leads.map((l) => l.id)).toEqual(['b']);
    expect(filterData(data, {}).leads).toHaveLength(2);
  });
});
