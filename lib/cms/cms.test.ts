import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RecordStore } from '../records/types';
import { BLOCK_KEYS, BLOCKS, canEditBlock, defaultContent } from './blocks';

let dir: string;
let cwd: string;
let store: RecordStore;
let cms: typeof import('./store');
let file: typeof import('../store/file');

const admin = { id: 'staff-admin', roles: ['super_admin' as const] };
const marketing = { id: 'staff-m', roles: ['data_executive' as const] };
const telecaller = { id: 'staff-t', roles: ['telecaller' as const] };

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-cms-'));
  process.chdir(dir);
  store = (await import('../records/fileStore')).createFileRecordStore();
  cms = await import('./store');
  file = await import('../store/file');
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('CMS blocks', () => {
  it('every sample default passes its own schema and is marked sample', () => {
    const c = defaultContent();
    for (const k of BLOCK_KEYS) expect((c[k] as { sample: boolean }).sample).toBe(true);
    expect(c.fees.twoYear.tuition).toBe(135000);
    expect(c.bsat.slabs[0]).toMatchObject({ min: 90, pct: 60 });
  });

  it('serves defaults until a block is saved, then the saved block', async () => {
    expect((await cms.loadContent(store)).results.items[0].name).toBe('A. Sai Charan');
    const real = { ...defaultContent().results, sample: false, items: [{ name: 'R. Real', exam: 'JEE Advanced', type: 'jee', year: 2027, score: 'AIR 99', verifyUrl: 'https://example.org/scorecard.pdf' }] };
    await cms.saveBlock(store, marketing, 'results', real);
    const c = await cms.loadContent(store);
    expect(c.results.sample).toBe(false);
    expect(c.results.items).toEqual([expect.objectContaining({ name: 'R. Real', score: 'AIR 99' })]);
    // other blocks untouched
    expect(c.fees.sample).toBe(true);
  });

  it('only the block’s editors may save it', async () => {
    expect(canEditBlock(['data_executive'], 'results')).toBe(true);
    expect(canEditBlock(['data_executive'], 'fees')).toBe(false);
    await expect(cms.saveBlock(store, telecaller, 'results', defaultContent().results)).rejects.toThrow('cannot edit');
    await expect(cms.saveBlock(store, marketing, 'fees', defaultContent().fees)).rejects.toThrow('cannot edit');
    await expect(cms.saveBlock(store, admin, 'nonsense', {})).rejects.toThrow('Unknown');
  });

  it('rejects invalid content with a message that names the field', async () => {
    const bad = { ...defaultContent().bsat, slabs: [{ min: 50, label: 'x', pct: 10 }, { min: 90, label: 'y', pct: 60 }] };
    await expect(cms.saveBlock(store, admin, 'bsat', bad)).rejects.toThrow('slabs: Sort the slabs');
    const badUrl = { ...defaultContent().results, items: [{ ...defaultContent().results.items[0], verifyUrl: 'javascript:alert(1)' }] };
    await expect(cms.saveBlock(store, admin, 'results', badUrl)).rejects.toThrow(/items › #1 › verifyUrl/);
    const bigBatch = { ...defaultContent().season, batchCap: 60 };
    await expect(cms.saveBlock(store, admin, 'season', bigBatch)).rejects.toThrow('40');
  });

  it('keeps earlier versions and restores one', async () => {
    const v1 = { ...defaultContent().faqs, items: [{ q: 'Version one?', a: 'Yes, version one.' }] };
    const v2 = { ...defaultContent().faqs, items: [{ q: 'Version two?', a: 'Yes, version two.' }] };
    await cms.saveBlock(store, marketing, 'faqs', v1);
    await cms.saveBlock(store, marketing, 'faqs', v2);
    const history = await cms.blockHistory(store, 'faqs');
    expect(history).toHaveLength(1);
    await cms.restoreBlock(store, marketing, 'faqs', history[0].id);
    expect((await cms.loadContent(store)).faqs.items[0].q).toBe('Version one?');
  });

  it('falls back to the default when a stored block no longer validates', async () => {
    await store.put('cms', { id: 'hostel', k1: 'hostel', k2: null, data: { value: { broken: true }, updatedBy: 'x' } });
    expect((await cms.loadContent(store)).hostel.blocks).toBe(defaultContent().hostel.blocks);
  });

  it('booking checks inside the file store use the saved CMS slots and BSAT sessions', async () => {
    const slots = { ...defaultContent().visitSlots, slots: [{ slot: '09:00', label: '9:00 AM', capacity: 1, saturday: true }] };
    await cms.saveBlock(store, admin, 'visitSlots', slots);
    const s = file.createFileStore();
    const date = '2030-01-07'; // a Monday
    await expect(s.createVisit({ name: 'Parent A', phone: '+919900000001', date, slot: '10:00', familySize: 1, consent: true })).rejects.toThrow();
    await s.createVisit({ name: 'Parent A', phone: '+919900000001', date, slot: '09:00', familySize: 1, consent: true });
    await expect(s.createVisit({ name: 'Parent B', phone: '+919900000002', date, slot: '09:00', familySize: 1, consent: true })).rejects.toThrow();

    const bsat = { ...defaultContent().bsat, sessions: [{ id: '2030-02-01-online', date: '2030-02-01', mode: 'online' as const }] };
    await cms.saveBlock(store, admin, 'bsat', bsat);
    await expect(s.registerBsat({ name: 'Student', studentName: 'Student', phone: '+919900000003', stream: 'MPC', sessionId: '2026-11-16-campus', consent: true })).rejects.toThrow();
    expect((await s.registerBsat({ name: 'Student', studentName: 'Student', phone: '+919900000003', stream: 'MPC', sessionId: '2030-02-01-online', consent: true })).hallTicket).toMatch(/^BSAT27-/);
  });

  it('defines an editor form for every block', () => {
    for (const k of BLOCK_KEYS) expect(BLOCKS[k].fields.length).toBeGreaterThan(0);
  });
});
