import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;
let chat: typeof import('./service');
let inbox: typeof import('./inbox');
let repo: import('../crm/types').CrmRepo;

const staff = (id: string, roles: string[]) => ({ id, fullName: id.replace('staff-', ''), email: null, phone: null, roles: roles as never, active: true });
const priya = staff('staff-priya', ['telecaller']);
const ramesh = staff('staff-ramesh', ['telecaller']);
const manager = staff('staff-manager', ['admission_manager']);

const MON_NOON = new Date('2026-11-02T06:30:00Z'); // 12:00 IST Monday: open
const MON_NIGHT = new Date('2026-11-02T16:30:00Z'); // 22:00 IST Monday: closed

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-chat-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  chat = await import('./service');
  inbox = await import('./inbox');
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('chat handoff inbox', () => {
  it('web handoff: creates the lead and a waiting conversation with the transcript; visitor token required', async () => {
    const { conversationId, token } = await chat.startWebHandoff(
      { name: 'Kavitha', phone: '+919666600001', question: 'Is there a bus from Kothapet?', transcript: [{ from: 'user', text: 'Fees' }, { from: 'bot', text: 'Tuition is ₹1,35,000…' }] },
      MON_NOON,
    );
    const conv = await chat.getConversationStore().get(conversationId);
    expect(conv).toMatchObject({ channel: 'web', status: 'waiting', assigneeId: null, contactName: 'Kavitha' });
    const msgs = await chat.getConversationStore().messages(conversationId);
    expect(msgs.map((m) => m.author)).toEqual(['contact', 'bot', 'contact', 'system']);
    expect(msgs.at(-1)!.text).toMatch(/counsellor will join/);
    expect(await chat.visitorPoll(conversationId, 'wrong-token-wrong-token', null)).toBeNull();
    expect((await chat.visitorPoll(conversationId, token, null))?.messages).toHaveLength(4);

    // Any telecaller can pick it up; then others cannot reply.
    expect((await inbox.inboxList(ramesh, 'waiting')).map((c) => c.id)).toContain(conversationId);
    await inbox.reply(priya, conversationId, 'Hello Kavitha, yes, the Kothapet route stops near the bus depot.');
    expect((await chat.getConversationStore().get(conversationId))).toMatchObject({ status: 'assigned', assigneeId: 'staff-priya' });
    await expect(inbox.reply(ramesh, conversationId, 'hi')).rejects.toThrow(/not found|Someone else/);
    expect(await inbox.inboxList(ramesh, 'open')).toEqual([]);
    await inbox.transfer(priya, conversationId, 'staff-ramesh', 'Ramesh handles transport');
    await inbox.reply(ramesh, conversationId, 'Ramesh here.');
    await expect(inbox.closeConversation(ramesh, conversationId, '')).rejects.toThrow(/outcome/);
    await inbox.closeConversation(ramesh, conversationId, 'Transport explained');
    expect(await chat.visitorSend(conversationId, token, 'thanks')).toMatchObject({ ok: false });
    const poll = await chat.visitorPoll(conversationId, token, null);
    expect(poll?.status).toBe('closed');
    // Visitor sees first names from the staff records, never staff ids.
    expect(poll?.messages.filter((m) => m.author === 'staff').map((m) => m.name)).toEqual(['Priya', 'Ramesh']);
    expect(JSON.stringify(poll)).not.toContain('staff-');
    // Internal transfer reason and close outcome stay staff-only.
    expect(JSON.stringify(poll)).not.toContain('handles transport');
    expect(JSON.stringify(poll)).not.toContain('Transport explained');
    expect(poll?.messages.map((m) => m.text)).toContain('You are now chatting with Ramesh from the admissions team.');
  });

  it('WhatsApp: routes to the lead owner, schedules a callback out of hours, enforces the 24h window', async () => {
    const store = (await import('../store/file')).createFileStore();
    const { leadId } = await store.captureLead({ name: 'Mahesh', phone: '+919666600002', consent: true, source: 'callback' });
    await repo.updateLead(leadId, { ownerId: 'staff-priya' }, []);

    const id = await chat.onWhatsAppInbound({ from: '+919666600002', text: 'Is hostel available for girls?', type: 'text', at: MON_NIGHT.toISOString(), leadId }, MON_NIGHT);
    const conv = (await chat.getConversationStore().get(id))!;
    expect(conv).toMatchObject({ status: 'assigned', assigneeId: 'staff-priya', unread: 1 });
    const msgs = await chat.getConversationStore().messages(id);
    expect(msgs.at(-1)).toMatchObject({ author: 'system', text: expect.stringMatching(/callback for Tuesday/) });
    expect((await repo.getLead(leadId))?.nextFollowUpAt).toBe('2026-11-03T01:30:00.000Z'); // Tue 07:00 IST

    // A second message joins the same conversation.
    expect(await chat.onWhatsAppInbound({ from: '+919666600002', text: 'Also AC rooms?', type: 'text', at: new Date(MON_NIGHT.getTime() + 60_000).toISOString(), leadId }, MON_NIGHT)).toBe(id);

    // A conversation whose last family message is weeks old: WhatsApp's 24-hour window is closed.
    const old = await chat.onWhatsAppInbound({ from: '+919666600003', text: 'hi', type: 'text', at: '2026-10-01T10:00:00Z', leadId: null }, MON_NOON);
    expect((await chat.getConversationStore().get(old))?.status).toBe('waiting');
    await expect(inbox.reply(manager, old, 'Hello')).rejects.toThrow(/24 hours/);
  });
});
