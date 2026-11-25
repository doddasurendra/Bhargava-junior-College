import 'server-only';
import { z } from 'zod';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { screenText } from '../studentLife/wellbeing';
import { obPosts, obProfiles } from './collections';
import { audit, need, OpenBookError, putFile, settings, staffActor, store, useQuota, type Actor } from './core';
import { aiConfigured, callJson, S } from './llm';
import { blockedContent, BLOCK_MESSAGE, lexicalSimilarity } from './text';
import { profileOf, saveProfile } from './challenge';

/**
 * College-only Q&A community (§20). Only signed-in BJC students and staff reach it (app/CRM auth). No private
 * messages exist. Students appear by nickname only; phone numbers, emails, links, social handles and abuse are
 * blocked before saving. Every post can be reported; 3 reports hide it until a moderator decides. Moderators
 * (teachers, academic heads, the counsellor) can hide, restore, suspend and verify. Distress signals go to the
 * existing counsellor safety protocol. Every moderation action is in the audit log.
 */
export const HIDE_AT = 3;
export type Post = { id: string; createdAt: string } & z.infer<typeof obPosts.schema>;
const asPost = (r: { id: string; createdAt: string; data: z.infer<typeof obPosts.schema> }): Post => ({ id: r.id, createdAt: r.createdAt, ...r.data });

async function guard(author: Actor, text: string) {
  const s = await settings();
  if (!s.communityEnabled) throw new OpenBookError('The community is switched off by the college right now.');
  const b = blockedContent(text);
  if (b) throw new OpenBookError(BLOCK_MESSAGE[b]);
  if (author.kind === 'student') {
    const p = await profileOf(author.id);
    if (p?.suspendedUntil && p.suspendedUntil > new Date().toISOString()) throw new OpenBookError(`Your community access is suspended until ${p.suspendedUntil.slice(0, 10)}.`);
  }
  const alert = await screenText('chat', `community:${author.id}:${Date.now()}`, author.kind === 'student' ? author.id : null, text).catch(() => null);
  return alert;
}

async function nicknameFor(a: Actor) {
  if (a.kind !== 'student') return `${a.name} (staff)`;
  return (await profileOf(a.id))?.nickname ?? (await saveProfile(a.id, {})).nickname;
}

/** Similar existing threads (lexical; shown before posting so duplicates link to the existing thread). */
export async function similarThreads(text: string, subject: string | null) {
  const roots = (await obPosts.list(store(), { k1: 'root' })).map(asPost).filter((p) => !p.hidden && (!subject || p.subject === subject));
  return roots.map((p) => ({ p, s: lexicalSimilarity(text, `${p.title} ${p.body}`) })).filter((x) => x.s >= 0.45).sort((a, b) => b.s - a.s).slice(0, 5).map((x) => ({ id: x.p.id, title: x.p.title, score: Math.round(x.s * 100) }));
}

export async function createThread(author: Actor, input: { title: string; body: string; subject: string; chapter: string | null; concept: string | null; image?: { name: string; bytes: Uint8Array; mime: string } | null; duplicateOf?: string | null }) {
  need(input.title.trim().length >= 5, 'Give your question a short title (5+ characters).');
  const alert = await guard(author, `${input.title}\n${input.body}`);
  let imageKey: string | null = null;
  if (input.image?.bytes.length) {
    need(/^image\/(png|jpe?g|webp)$/.test(input.image.mime) && input.image.bytes.length <= 5 * 1024 * 1024, 'Images: PNG/JPG up to 5 MB.');
    imageKey = await putFile('post', input.image.bytes, input.image.mime);
  }
  const r = await obPosts.put(store(), { threadId: null, author, nickname: await nicknameFor(author), title: input.title.trim(), body: input.body.trim(), imageKey, subject: input.subject, chapter: input.chapter, concept: input.concept, duplicateOf: input.duplicateOf ?? null });
  await audit(author, 'community.post', r.id);
  return { id: r.id, alert };
}

export async function answer(author: Actor, threadId: string, body: string) {
  const t = await obPosts.get(store(), threadId);
  need(t && !t.data.threadId && !t.data.hidden, 'Question not found.');
  const alert = await guard(author, body);
  const r = await obPosts.put(store(), { threadId, author, nickname: await nicknameFor(author), title: '', body: body.trim(), subject: t!.data.subject, chapter: t!.data.chapter, concept: t!.data.concept });
  if (author.kind === 'student') await bumpReputation(author.id, 1);
  return { id: r.id, alert };
}

/** AI-suggested answer, clearly labelled "AI" (needs ANTHROPIC_API_KEY). */
export async function aiSuggest(requester: Actor, threadId: string) {
  const t = await obPosts.get(store(), threadId);
  need(t && !t.data.threadId, 'Question not found.');
  if (!aiConfigured()) throw new (await import('./llm')).AiNotConfigured();
  await useQuota(requester.id, 'ai');
  const r = await callJson({ system: 'You suggest a clear, correct, step-by-step answer to a student question in a college study community (TS Intermediate, JEE, NEET). Teach the method; keep it under 300 words; plain text with Unicode symbols. If the question is unclear, say what is missing.', parts: [{ kind: 'text', text: `${t!.data.title}\n\n${t!.data.body}` }], jsonSchema: S.obj({ answer: S.str() }), validate: z.object({ answer: z.string() }), effort: 'medium', maxTokens: 4000 });
  const p = await obPosts.put(store(), { threadId, author: { kind: 'system', id: 'ai', name: 'Open Book AI' }, nickname: 'Open Book AI', title: '', body: r.data.answer.slice(0, 8000), subject: t!.data.subject, chapter: t!.data.chapter, concept: t!.data.concept, ai: true });
  return p.id;
}

export async function listThreads(f: { subject?: string; q?: string; includeHidden?: boolean } = {}) {
  const roots = (await obPosts.list(store(), { k1: 'root' })).map(asPost);
  const answers = (await obPosts.list(store())).filter((r) => r.data.threadId).map(asPost);
  const w = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return roots
    .filter((p) => f.includeHidden || !p.hidden)
    .filter((p) => !f.subject || p.subject === f.subject)
    .filter((p) => !w.length || w.every((x) => `${p.title} ${p.body} ${p.chapter ?? ''} ${p.concept ?? ''}`.toLowerCase().includes(x)))
    .map((p) => ({ ...p, answers: answers.filter((a) => a.threadId === p.id && !a.hidden).length }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function thread(id: string, includeHidden = false) {
  const t = await obPosts.get(store(), id);
  if (!t || t.data.threadId || (t.data.hidden && !includeHidden)) return null;
  const answers = (await obPosts.list(store(), { k1: id })).map(asPost).filter((a) => includeHidden || !a.hidden);
  answers.sort((a, b) => (b.id === t.data.acceptedId ? 1 : 0) - (a.id === t.data.acceptedId ? 1 : 0) || (b.verifiedBy ? 1 : 0) - (a.verifiedBy ? 1 : 0) || b.votes.length - a.votes.length || a.createdAt.localeCompare(b.createdAt));
  return { thread: asPost(t), answers };
}

export async function vote(voterId: string, postId: string) {
  const p = await obPosts.get(store(), postId);
  need(p && !p.data.hidden, 'Post not found.');
  need(p!.data.author.id !== voterId, 'You can’t upvote your own post.');
  const votes = p!.data.votes.includes(voterId) ? p!.data.votes.filter((v) => v !== voterId) : [...p!.data.votes, voterId];
  await obPosts.put(store(), { ...p!.data, votes }, postId);
  if (p!.data.author.kind === 'student') await bumpReputation(p!.data.author.id, votes.length > p!.data.votes.length ? 2 : -2);
}

/** The asker accepts an answer. */
export async function accept(askerId: string, threadId: string, answerId: string) {
  const t = await obPosts.get(store(), threadId);
  need(t && t.data.author.id === askerId, 'Only the person who asked can accept an answer.');
  const a = await obPosts.get(store(), answerId);
  need(a && a.data.threadId === threadId, 'Answer not found.');
  await obPosts.put(store(), { ...t!.data, acceptedId: answerId }, threadId);
  if (a!.data.author.kind === 'student') await bumpReputation(a!.data.author.id, 10);
}

export const canModerate = (u: Staff) => can(u, 'ob.moderate');

/** A teacher marks an answer "teacher verified". */
export async function verify(u: Staff, answerId: string, on = true) {
  need(canModerate(u));
  const a = await obPosts.get(store(), answerId);
  need(a && a.data.threadId, 'Answer not found.');
  await obPosts.put(store(), { ...a!.data, verifiedBy: on ? u.fullName : null }, answerId);
  if (on && a!.data.author.kind === 'student') await bumpReputation(a!.data.author.id, 15);
  await audit(staffActor(u), on ? 'community.verify' : 'community.unverify', answerId);
}

export async function report(reporterId: string, postId: string, reason: string) {
  const p = await obPosts.get(store(), postId);
  need(p, 'Post not found.');
  need(reason.trim().length >= 3, 'Say briefly what is wrong.');
  if (p!.data.reports.some((r) => r.by === reporterId)) return { hidden: p!.data.hidden };
  const reports = [...p!.data.reports, { by: reporterId, reason: reason.slice(0, 200), at: new Date().toISOString() }];
  const hidden = p!.data.hidden || reports.length >= HIDE_AT;
  await obPosts.put(store(), { ...p!.data, reports, hidden, hiddenReason: hidden && !p!.data.hidden ? `Hidden automatically after ${HIDE_AT} reports` : p!.data.hiddenReason }, postId);
  await audit({ kind: 'student', id: reporterId, name: '' }, 'community.report', postId, reason.slice(0, 200));
  return { hidden };
}

export async function moderationQueue() {
  return (await obPosts.list(store())).map(asPost).filter((p) => p.reports.length > 0 || p.hidden).sort((a, b) => b.reports.length - a.reports.length);
}

export async function moderate(u: Staff, postId: string, action: 'hide' | 'restore', note: string | null) {
  need(canModerate(u));
  const p = await obPosts.get(store(), postId);
  need(p, 'Post not found.');
  await obPosts.put(store(), { ...p!.data, hidden: action === 'hide', hiddenReason: action === 'hide' ? note ?? 'Hidden by a moderator' : null, reports: action === 'restore' ? [] : p!.data.reports }, postId);
  await audit(staffActor(u), `community.${action}`, postId, note);
}

/** Suspends a student from the community (days = 0 lifts it). */
export async function suspend(u: Staff, studentId: string, days: number, note: string | null) {
  need(canModerate(u));
  const until = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  const r = (await obProfiles.list(store(), { k1: studentId }))[0];
  const base = r?.data ?? (await saveProfile(studentId, {}));
  await obProfiles.put(store(), { ...base, suspendedUntil: until }, r?.id ?? (await obProfiles.list(store(), { k1: studentId }))[0]?.id);
  await audit(staffActor(u), days > 0 ? 'community.suspend' : 'community.unsuspend', studentId, `${days} days. ${note ?? ''}`);
}

async function bumpReputation(studentId: string, n: number) {
  const r = (await obProfiles.list(store(), { k1: studentId }))[0];
  const base = r?.data ?? (await saveProfile(studentId, {}));
  await obProfiles.put(store(), { ...base, reputation: Math.max(0, (base.reputation ?? 0) + n) }, r?.id ?? (await obProfiles.list(store(), { k1: studentId }))[0]?.id);
}

export function badgesFor(reputation: number) {
  return [[10, 'Helper'], [50, 'Problem solver'], [150, 'Mentor'], [400, 'Open Book star']].filter(([n]) => reputation >= (n as number)).map(([, b]) => b as string);
}
