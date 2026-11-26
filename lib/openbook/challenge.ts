import 'server-only';
import { addDays, todayIST } from '../dates';
import { practiceAttempts, syllabusProgress } from '../records/collections';
import { batchOf, studentsById } from '../school/common';
import { houses } from '../studentLife/collections';
import { obAttempts, obChallengeAttempts, obChallenges, obProfiles, obQuestions } from './collections';
import { need, OpenBookError, store } from './core';
import { attempt, getQuestions } from './questions';
import { PRACTICE_CHAPTER_ALIAS } from './taxonomy';

/**
 * Daily Challenge & leaderboards (§22). Each batch gets the same 5 questions per subject each day, open
 * 06:00–23:00 IST, drawn from the approved bank and weighted to chapters the batch has covered (syllabus
 * progress). XP and the practice streak reuse the existing Practice XP system (attempts are also written to
 * practice_attempts). Leaderboards show only the top 10 plus "your position", honour opt-outs, never list the
 * bottom, and include effort boards so every student can rank.
 */
export const PER_SUBJECT = 5;

function istHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now));
}
export const challengeOpen = (now = new Date()) => { const h = istHour(now); return h >= 6 && h < 23; };

function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
}

export async function todaysChallenge(batchId: string, program: string, today = todayIST()) {
  const have = (await obChallenges.list(store(), { k1: batchId, k2: today }))[0];
  if (have) return { id: have.id, ...have.data };
  const subjects = /neet/i.test(program) ? ['Physics', 'Chemistry', 'Biology'] : ['Physics', 'Chemistry', 'Mathematics'];
  const covered = new Set((await syllabusProgress.list(store(), { k1: batchId })).filter((s) => s.data.status !== 'not_started').map((s) => PRACTICE_CHAPTER_ALIAS[s.data.chapter] ?? s.data.chapter));
  const pool = (await obQuestions.list(store(), { k1: 'bank' })).filter((r) => r.data.status === 'approved' && r.data.answer.length && ['mcq_single', 'numerical', 'true_false'].includes(r.data.type));
  const rnd = seeded(`${batchId}:${today}`);
  const sets: Record<string, string[]> = {};
  for (const s of subjects) {
    const subj = pool.filter((r) => r.data.subject === s);
    const pref = subj.filter((r) => covered.has(r.data.chapter));
    const src = pref.length >= PER_SUBJECT ? pref : subj;
    sets[s] = [...src].sort(() => rnd() - 0.5).slice(0, PER_SUBJECT).map((r) => r.id);
  }
  const r = await obChallenges.put(store(), { batchId, date: today, sets });
  return { id: r.id, ...r.data };
}

export async function challengeFor(studentId: string) {
  const b = await batchOf(studentId);
  need(b, 'You are not in a batch yet, so there is no batch challenge.');
  const c = await todaysChallenge(b!.id, `${b!.data.program}`);
  const done = (await obChallengeAttempts.list(store(), { k1: studentId, k2: c.date })).map((a) => a.data);
  const qs = Object.fromEntries(await Promise.all(Object.entries(c.sets).map(async ([s, ids]) => [s, await getQuestions(ids)] as const)));
  return { batchId: b!.id, date: c.date, open: challengeOpen(), sets: qs, done, streak: await challengeStreak(studentId) };
}

export async function submitChallenge(studentId: string, subject: string, answers: Record<string, string>) {
  if (!challengeOpen()) throw new OpenBookError('The daily challenge is open from 6 AM to 11 PM.');
  const b = await batchOf(studentId);
  need(b, 'You are not in a batch yet.');
  const c = await todaysChallenge(b!.id, `${b!.data.program}`);
  need(c.sets[subject], 'Choose a subject.');
  const already = (await obChallengeAttempts.list(store(), { k1: studentId, k2: c.date })).some((a) => a.data.subject === subject);
  if (already) throw new OpenBookError(`You have already done today's ${subject} challenge.`);
  let correct = 0;
  for (const q of await getQuestions(c.sets[subject])) {
    const r = await attempt(studentId, b!.id, q, answers[q.id] ? [answers[q.id]] : [], 0, 'challenge');
    if (r.correct) correct++;
  }
  const xp = correct * 10 + 10; // 10 XP for taking part, 10 per correct answer
  await obChallengeAttempts.put(store(), { studentId, batchId: b!.id, date: c.date, subject, correct, total: c.sets[subject].length, xp });
  return { correct, total: c.sets[subject].length, xp };
}

export async function challengeStreak(studentId: string, today = todayIST()) {
  const dates = new Set((await obChallengeAttempts.list(store(), { k1: studentId })).filter((a) => a.data.subject !== WEEKLY_BONUS).map((a) => a.data.date));
  let d = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// ---------------------------------------------------------------- profile (nickname, opt-out)

export async function profileOf(studentId: string) {
  const r = (await obProfiles.list(store(), { k1: studentId }))[0];
  return r ? { id: r.id, ...r.data } : null;
}
export async function saveProfile(studentId: string, patch: { nickname?: string; optOut?: boolean; dailyMinutes?: number; lang?: 'en' | 'te' | 'hi' }) {
  const { blockedContent, BLOCK_MESSAGE } = await import('./text');
  if (patch.nickname) {
    const b = blockedContent(patch.nickname);
    if (b) throw new OpenBookError(BLOCK_MESSAGE[b]);
    need(/^[\p{L}\p{N} _.-]{3,24}$/u.test(patch.nickname), 'Nicknames are 3–24 letters, numbers, spaces, dots, dashes or underscores.');
    const taken = (await obProfiles.list(store())).some((p) => p.data.studentId !== studentId && p.data.nickname.toLowerCase() === patch.nickname!.toLowerCase());
    need(!taken, 'That nickname is taken. Try another.');
  }
  const r = await profileOf(studentId);
  const next = { studentId, nickname: r?.nickname ?? `Learner${Math.floor(1000 + Math.random() * 9000)}`, optOut: false, reputation: 0, suspendedUntil: null, dailyMinutes: 60, lang: 'en' as const, ...(r ?? {}), ...patch };
  const { id: _id, ...data } = next as typeof next & { id?: string };
  await obProfiles.put(store(), data, r?.id);
  return data;
}

// ---------------------------------------------------------------- leaderboards

export type Board = 'score' | 'effort' | 'streak';
export type Period = 'daily' | 'weekly' | 'monthly';

export async function leaderboard(studentId: string, scope: 'batch' | 'college', board: Board, period: Period, today = todayIST()) {
  const from = period === 'daily' ? today : period === 'weekly' ? addDays(today, -6) : addDays(today, -29);
  const b = await batchOf(studentId);
  const [chal, ob, prac, profiles, byId] = await Promise.all([obChallengeAttempts.list(store()), obAttempts.list(store()), practiceAttempts.list(store()), obProfiles.list(store()), studentsById()]);
  const members = new Set(b?.data.studentIds ?? []);
  const inScope = (sid: string, _batchId?: string | null) => scope === 'college' ? byId.has(sid) : members.has(sid);
  const score = new Map<string, number>();
  const add = (sid: string, n: number) => score.set(sid, (score.get(sid) ?? 0) + n);
  if (board === 'score') for (const c of chal) { if (c.data.date >= from && inScope(c.data.studentId, c.data.batchId)) add(c.data.studentId, c.data.xp); }
  if (board === 'effort') {
    for (const a of ob) if (a.data.date >= from && inScope(a.data.studentId)) add(a.data.studentId, 1);
    for (const a of prac) if (a.data.date >= from && !String(a.data.setId ?? '').startsWith('openbook:') && inScope(a.data.studentId, a.data.batchId)) add(a.data.studentId, 1);
  }
  if (board === 'streak') for (const sid of new Set(chal.map((c) => c.data.studentId))) if (inScope(sid)) add(sid, await challengeStreak(sid, today));
  const prof = new Map(profiles.map((p) => [p.data.studentId, p.data]));
  const ranked = [...score.entries()].filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
  const label = (sid: string) => (prof.get(sid)?.optOut ? 'Hidden (opted out)' : prof.get(sid)?.nickname ?? 'Learner');
  const top = ranked.slice(0, 10).map(([sid, n], i) => ({ rank: i + 1, name: label(sid), value: n, me: sid === studentId }));
  const myIndex = ranked.findIndex(([sid]) => sid === studentId);
  const me = myIndex >= 0 ? { rank: myIndex + 1, value: ranked[myIndex][1], of: ranked.length } : null;
  // private encouragement instead of public shaming (§22)
  const encouragement = me && me.rank > Math.max(10, Math.ceil(ranked.length * 0.6)) ? 'Every question you practise counts. Try today’s challenge and a 10-card flashcard session: small steps add up quickly.' : !me ? 'Do today’s challenge to join the board.' : null;
  return { top, me, encouragement, total: ranked.length, unit: board === 'score' ? 'XP' : board === 'effort' ? 'questions' : 'day streak' };
}

/** House points from the Sports module houses: challenge XP this week per house. */
export async function housePoints(today = todayIST()) {
  const [hs, chal] = await Promise.all([houses.list(store()), obChallengeAttempts.list(store())]);
  const from = addDays(today, -6);
  return hs.map((h) => ({ name: h.data.name, color: h.data.color, points: chal.filter((c) => c.data.date >= from && h.data.studentIds.includes(c.data.studentId)).reduce((s, c) => s + c.data.xp, 0) })).sort((a, b) => b.points - a.points);
}

/** Weekly winners: top 3 by challenge XP in the batch over the 7 days before `today` (opted-out students excluded). */
export async function weeklyWinners(batchId: string, today = todayIST()) {
  const from = addDays(today, -7), to = addDays(today, -1);
  const chal = (await obChallengeAttempts.list(store())).filter((c) => c.data.batchId === batchId && c.data.date >= from && c.data.date <= to && c.data.subject !== WEEKLY_BONUS);
  const prof = new Map((await obProfiles.list(store())).map((p) => [p.data.studentId, p.data]));
  const m = new Map<string, number>();
  for (const c of chal) m.set(c.data.studentId, (m.get(c.data.studentId) ?? 0) + c.data.xp);
  return [...m.entries()].filter(([sid]) => !prof.get(sid)?.optOut).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([sid, xp]) => ({ studentId: sid, name: prof.get(sid)?.nickname ?? 'Learner', xp }));
}

export const WEEKLY_BONUS = 'Weekly winner bonus';

/**
 * Posts each batch's weekly winners to Notices (the existing notices module: students and parents of the batch
 * see it) with the reward the admin set, and credits the optional bonus XP. Idempotent per batch and week.
 */
export async function announceWeeklyWinners(today = todayIST()) {
  const { settings } = await import('./core');
  const { notices } = await import('../records/collections');
  const { allBatches } = await import('../school/common');
  const s = await settings();
  if (!s.announceWinners) return { posted: 0, skipped: 'switched off' };
  const week = `${addDays(today, -7)} to ${addDays(today, -1)}`;
  let posted = 0;
  for (const b of await allBatches()) {
    if (!b.data.active) continue;
    const audience = `batch:${b.id}`;
    const already = (await notices.list(store(), { k1: audience })).some((n) => n.data.title.includes(week));
    if (already) continue;
    const winners = await weeklyWinners(b.id, today);
    if (!winners.length) continue;
    const medals = ['🥇', '🥈', '🥉'];
    const body = `Open Book Daily Challenge, ${week}, ${b.data.name}:\n${winners.map((w, i) => `${medals[i]} ${w.name}: ${w.xp} XP`).join('\n')}${s.weeklyReward ? `\n\nReward: ${s.weeklyReward}` : ''}${s.weeklyBonusXp ? `\nEach winner gets ${s.weeklyBonusXp} bonus XP.` : ''}\n\nNames are Open Book nicknames; students who opted out of leaderboards are never listed. Well done to everyone who practised every day!`;
    await notices.put(store(), { title: `Weekly challenge winners (${week})`, body, audience, date: today, publishedBy: 'open-book', attachmentUrl: null });
    if (s.weeklyBonusXp) for (const w of winners) await obChallengeAttempts.put(store(), { studentId: w.studentId, batchId: b.id, date: today, subject: WEEKLY_BONUS, correct: 0, total: 0, xp: s.weeklyBonusXp });
    posted++;
  }
  return { posted };
}