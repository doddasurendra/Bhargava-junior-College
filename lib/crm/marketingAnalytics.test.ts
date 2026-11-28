import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string, cwd: string;
beforeAll(() => { cwd = process.cwd(); dir = mkdtempSync(path.join(tmpdir(), 'bjc-mkt-')); process.chdir(dir); delete process.env.SUPABASE_URL; });
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

const manager = { id: 'staff-am', fullName: 'Admission Manager', email: null, phone: null, roles: ['admission_manager' as const], active: true };
const faculty = { ...manager, id: 'f', roles: ['faculty' as const] };
const marketing = { ...manager, id: 'staff-mk', roles: ['data_executive' as const] };

describe('marketing analytics', () => {
  it('counts real enquiries by stage, source and campaign; forecast refuses to guess without history; follow-ups needing attention', async () => {
    const { createFileStore } = await import('../store/file');
    const store = createFileStore();
    const repo = (await import('./fileRepo')).createFileCrmRepo();
    const A = await import('./marketingAnalytics');
    const { todayIST, addDays } = await import('../dates');
    const t = todayIST();
    const mk = (phone: string, source: 'enquiry' | 'callback', campaign?: string) => store.captureLead({ name: 'Parent', phone, consent: true, source, program: 'iit-jee', attribution: campaign ? { utm_campaign: campaign, utm_source: 'instagram' } : undefined });
    const a = await mk('+919811100001', 'enquiry', 'insta-jee');
    const b = await mk('+919811100002', 'enquiry', 'insta-jee');
    const c = await mk('+919811100003', 'callback');
    await repo.updateLead(a.leadId, { status: 'confirmed', category: 'hot' }, []);
    await repo.updateLead(b.leadId, { status: 'lost' }, []);
    await repo.updateLead(c.leadId, { category: 'hot' }, []);
    await expect(A.saveCampaign(manager, { name: 'X', code: 'x-1', channel: 'other', startDate: t })).rejects.toThrow(/Only marketing/);
    await A.saveCampaign(marketing, { name: 'Instagram JEE', code: 'INSTA-JEE', channel: 'social_media', startDate: addDays(t, -10), budget: 20000 });
    await expect(A.saveCampaign(marketing, { name: 'Dup', code: 'insta-jee', channel: 'other', startDate: t })).rejects.toThrow(/already uses/);
    await expect(A.marketingAnalytics(faculty, { from: addDays(t, -30), to: t })).rejects.toThrow(/Only marketing/);
    const m = await A.marketingAnalytics(manager, { from: addDays(t, -30), to: t });
    expect(m.totals).toMatchObject({ enquiries: 3, confirmed: 1 });
    expect(m.totals.conversion).toBe(33.3);
    const stage = Object.fromEntries(m.pipeline.map((p) => [p.key, p.value]));
    expect(stage).toMatchObject({ confirmed: 1, not_interested: 1, interested: 1 });
    expect(m.sources.find((s) => s.source === 'enquiry')).toMatchObject({ leads: 2, confirmed: 1, conversion: 50 });
    const camp = m.campaigns.find((x) => x.code === 'insta-jee')!;
    expect(camp).toMatchObject({ name: 'Instagram JEE', leads: 2, confirmed: 1, budget: 20000, costPerAdmission: 20000, registered: true });
    expect(m.forecast).toMatchObject({ insufficient: true }); // only 2 decided enquiries: no guess
    expect(m.attention.map((x) => x.id)).toContain(c.leadId); // hot, never contacted
    expect(m.attention.find((x) => x.id === c.leadId)!.recommendation).toMatch(/24 hours|Due now|Overdue/);
    // campaign filter narrows everything to that campaign's enquiries
    const only = await A.marketingAnalytics(manager, { from: addDays(t, -30), to: t, campaign: 'insta-jee' });
    expect(only.totals.enquiries).toBe(2);
  });
});
