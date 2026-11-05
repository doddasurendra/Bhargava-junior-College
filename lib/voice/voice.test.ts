import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FEMALE_VOICES, ssmlFor, toSpeech } from './speech';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;
beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-voice-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  delete process.env.ANTHROPIC_API_KEY; // no AI key → the assistants answer from the shared knowledge base
  process.env.ASSISTANT_DISABLED = '1';
  delete process.env.AZURE_SPEECH_KEY;
});
afterAll(() => {
  delete process.env.ASSISTANT_DISABLED;
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('voice speech helpers', () => {
  it('makes answers speakable and uses a female neural voice per language', () => {
    expect(toSpeech('**Fees**: ₹1,35,000 per year. See [fees](/fees) or https://x.y/z\n- Hostel extra 😀')).toBe('Fees: rupees 1,35,000 per year. See fees or. Hostel extra');
    expect(Object.values(FEMALE_VOICES).map((v) => v.voice)).toEqual(['en-IN-NeerjaNeural', 'te-IN-ShrutiNeural', 'hi-IN-SwaraNeural']);
    const ssml = ssmlFor('Fees & <hostel>', 'te');
    expect(ssml).toContain('te-IN-ShrutiNeural');
    expect(ssml).toContain('Fees &amp; &lt;hostel&gt;');
    expect(toSpeech('a. '.repeat(600)).length).toBeLessThanOrEqual(900);
  });
});

const post = (url: string, body: unknown) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200)}` }, body: JSON.stringify(body) });

describe('voice agent and chat agent end to end (shared knowledge base, separate sessions)', () => {
  it('answers from verified content in English, Telugu and Hindi; never guesses; keeps sessions separate', async () => {
    const voice = await import('../../app/api/voice/turn/route');
    const chat = await import('../../app/api/assistant/route');
    const tts = await import('../../app/api/voice/tts/route');

    const hello = await (await voice.POST(post('http://localhost/api/voice/turn', { text: 'Hi' }))).json();
    expect(hello.speech).toBe('Hello! Welcome to Bhargava Junior College. How can I help you today?');
    const namaste = await (await chat.POST(post('http://localhost/api/assistant', { text: 'नमस्ते' }))).json();
    expect(namaste.reply).toMatch(/भार्गव जूनियर कॉलेज में आपका स्वागत/);

    const v1 = await (await voice.POST(post('http://localhost/api/voice/turn', { text: 'What is the college address?' }))).json();
    // no sentence repeated in an answer
    const sentences = (v1.caption as string).split(/(?<=[.!?])\s+/).map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    expect(new Set(sentences).size).toBe(sentences.length);
    expect(v1.speech).toMatch(/Saroornagar/);
    expect(v1.speech).not.toMatch(/https?:|\/contact/);
    expect(v1.sources.length).toBeGreaterThan(0);

    // follow-up in the same voice session
    const v2 = await (await voice.POST(post('http://localhost/api/voice/turn', { c: v1.c, t: v1.t, text: 'and your office timings?' }))).json();
    expect(v2.c).toBe(v1.c);
    expect(v2.speech).toMatch(/Monday/);

    const te = await (await voice.POST(post('http://localhost/api/voice/turn', { text: 'మీ కాలేజీ చిరునామా ఏమిటి?' }))).json();
    expect(te.lang).toBe('te');
    expect(te.speech).toMatch(/Saroornagar/);

    const unknown = await (await voice.POST(post('http://localhost/api/voice/turn', { text: 'Who will win the next cricket world cup?' }))).json();
    expect(unknown.speech).toMatch(/couldn't find verified information|counsellor/i);

    // The chat agent is a separate session on a separate endpoint, with the same facts.
    const c1 = await (await chat.POST(post('http://localhost/api/assistant', { text: 'where is the college located?' }))).json();
    expect(c1.c).not.toBe(v1.c);
    expect(c1.reply).toMatch(/Saroornagar/);
    const hi = await (await chat.POST(post('http://localhost/api/assistant', { text: 'आपके कॉलेज का पता क्या है?' }))).json();
    expect(hi.reply).toMatch(/Saroornagar/);

    // Without an Azure key the TTS endpoint tells the client to use the browser's female voice.
    const r = await tts.POST(post('http://localhost/api/voice/tts', { text: 'Hello', lang: 'en' }));
    expect(r.status).toBe(204);
    expect(r.headers.get('x-tts')).toBe('browser');
  }, 60_000);
});
