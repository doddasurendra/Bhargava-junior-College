'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { LANG_COOKIE, LANGS, type Lang } from '@/lib/i18n';

/** Language picker for the Knowledge Hub (same cookie as the website). */
export function KbLangSwitch({ current, label }: { current: Lang; label: string }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      {label}
      <select
        value={current}
        onChange={(e) => {
          document.cookie = `${LANG_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="input w-auto py-1 text-xs"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Knowledge Hub tabs; the current section is highlighted. */
export function KbSubNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const best = items.filter((i) => path === i.href || path.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Knowledge Hub" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={best === i.href ? 'page' : undefined} className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${best === i.href ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line hover:border-gold'}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Renders «term» markers from the search highlighter as <mark>. */
export function Marked({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*»)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('«') ? <mark key={i} className="rounded bg-gold/30 px-0.5 text-inherit">{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

interface AskSource {
  title: string;
  href: string;
  page: number | null;
  section: string | null;
}
interface AskReply {
  text: string;
  found: boolean;
  sources: AskSource[];
  mode: string;
  basedOn: string;
  convId: string;
  index: number;
  rows?: { label: string; value: string }[];
  error?: string;
}

/**
 * The role-aware AI box (§17). Talks to /api/kb/ask; the server decides what the asker may see. Shows sources
 * with page numbers, "based on", 👍/👎 feedback, and works the same in all three languages.
 */
export function AskBox({ assistants, initial, labels, suggestions, compact = false, surface }: { assistants: { id: string; name: string }[]; initial: string; labels: { placeholder: string; ask: string; sources: string; page: string; basedOn: string; helpful: string; notHelpful: string; suggested: string }; suggestions: string[]; compact?: boolean; surface?: 'app' | 'staff' }) {
  const [assistant, setAssistant] = useState(initial);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ q: string; r: AskReply; fb?: 'up' | 'down' }[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setQ('');
    try {
      const res = await fetch('/api/kb/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assistant, q: question, surface }) });
      const r = (await res.json()) as AskReply;
      setLog((l) => [{ q: question, r: res.ok ? r : { ...r, text: r.error ?? 'Something went wrong.', found: false, sources: [], mode: 'error', basedOn: '', convId: '', index: -1 } }, ...l]);
    } catch {
      setLog((l) => [{ q: question, r: { text: 'Network error. Please try again.', found: false, sources: [], mode: 'error', basedOn: '', convId: '', index: -1 } }, ...l]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  async function rate(i: number, up: boolean) {
    const item = log[i];
    if (!item.r.convId) return;
    setLog((l) => l.map((x, j) => (j === i ? { ...x, fb: up ? 'up' : 'down' } : x)));
    await fetch('/api/kb/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ convId: item.r.convId, index: item.r.index, up }) });
  }

  return (
    <div className="space-y-3">
      {assistants.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Assistant">
          {assistants.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={a.id === assistant} onClick={() => setAssistant(a.id)} className={`rounded-full border px-3 py-1 text-xs font-medium ${a.id === assistant ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line text-ink hover:border-gold'}`}>
              {a.name}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
        className="flex gap-2"
      >
        <textarea
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(q);
            }
          }}
          rows={compact ? 1 : 2}
          maxLength={1000}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="input min-w-0 flex-1 resize-y text-sm"
        />
        <button className="btn-primary shrink-0 self-start py-2" disabled={busy}>
          {busy ? '…' : labels.ask}
        </button>
      </form>
      {!log.length && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">{labels.suggested}:</span>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-dashed border-line px-2.5 py-1 hover:border-gold">
              {s}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-3" aria-live="polite">
        {log.map((x, i) => (
          <li key={i} className="rounded-xl border border-line bg-surface p-3 text-sm">
            <p className="font-semibold text-heading">{x.q}</p>
            <p className="mt-1.5 whitespace-pre-line leading-6 text-ink">{x.r.text}</p>
            {x.r.rows && x.r.rows.length > 0 && (
              <table className="mt-2 w-full text-xs">
                <tbody>
                  {x.r.rows.map((r, j) => (
                    <tr key={j} className="border-t border-line">
                      <td className="py-1 pr-2 text-muted">{r.label}</td>
                      <td className="py-1 font-mono">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {x.r.sources.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="font-semibold text-muted">{labels.sources}: </span>
                {x.r.sources.map((s, j) => (
                  <a key={j} href={s.href} className="mr-2 underline">
                    [{j + 1}] {s.title}
                    {s.page ? ` · ${labels.page} ${s.page}` : s.section ? ` · ${s.section}` : ''}
                  </a>
                ))}
              </div>
            )}
            {x.r.basedOn && <p className="mt-1 text-[11px] text-muted">{labels.basedOn}: {x.r.basedOn}{x.r.mode === 'grounded' ? ' (quoted, no AI model)' : x.r.mode === 'llm' ? ' (AI answer)' : ''}</p>}
            {x.r.convId && (
              <div className="mt-2 flex gap-2 text-xs">
                <button type="button" aria-pressed={x.fb === 'up'} onClick={() => void rate(i, true)} className={`rounded-full border px-2 py-0.5 ${x.fb === 'up' ? 'border-emerald-600 text-emerald-700' : 'border-line'}`}>
                  👍 {labels.helpful}
                </button>
                <button type="button" aria-pressed={x.fb === 'down'} onClick={() => void rate(i, false)} className={`rounded-full border px-2 py-0.5 ${x.fb === 'down' ? 'border-maroon text-maroon' : 'border-line'}`}>
                  👎 {labels.notHelpful}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Drag-and-drop multi-file upload with a progress bar (§2). Posts to /api/kb/upload with XHR (fetch has no
 * upload progress). The metadata fields are rendered by the server page inside this form.
 */
export function UploadZone({ children, accept, maxMb, labels }: { children: React.ReactNode; accept: string; maxMb: number; labels: { drop: string; choose: string; upload: string; tooBig: string } }) {
  const [files, setFiles] = useState<File[]>([]);
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 20);
    const big = next.filter((f) => f.size > maxMb * 1024 * 1024);
    setMsg(big.length ? { ok: false, text: `${labels.tooBig}: ${big.map((f) => f.name).join(', ')}` } : null);
    setFiles(next.filter((f) => f.size <= maxMb * 1024 * 1024));
  };

  /** Big files (> 4 MB) go straight to Supabase Storage with a signed URL, so the 4.5 MB hosting limit doesn't apply. */
  async function direct(f: File, meta: FormData): Promise<string | null> {
    const sign = await fetch('/api/kb/upload/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: f.size }) }).then((r) => r.json()).catch(() => null);
    if (!sign?.direct) return null;
    await new Promise<void>((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', sign.url);
      x.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100));
      x.onload = () => (x.status < 300 ? resolve() : reject(new Error(`storage HTTP ${x.status}`)));
      x.onerror = () => reject(new Error('network'));
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', f);
      x.send(body);
    });
    const m = Object.fromEntries([...meta.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    const channels = ['website', 'app', 'bot', 'staff'].filter((c) => m[`ch_${c}`] === 'on');
    const done = await fetch('/api/kb/upload/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...m, key: sign.key, name: f.name, channels }) }).then((r) => r.json());
    return done.ok ? done.message : `${f.name}: ${done.error}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length || !form.current) return;
    const fd = new FormData(form.current);
    fd.delete('files');
    const notes: string[] = [];
    const small: File[] = [];
    for (const f of files) {
      if (f.size > 4 * 1024 * 1024) {
        setPct(0);
        try {
          const r = await direct(f, fd);
          if (r === null) small.push(f);
          else notes.push(r);
        } catch (err) {
          notes.push(`${f.name}: ${(err as Error).message}`);
        }
      } else small.push(f);
    }
    if (!small.length) {
      setPct(null);
      setMsg({ ok: true, text: notes.join(' ') });
      setFiles([]);
      router.refresh();
      return;
    }
    for (const f of small) fd.append('files', f);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/kb/upload');
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      setPct(null);
      let body: { ok?: boolean; message?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = { error: xhr.status === 413 ? 'Too large for this server in one request (hosting limit). Upload fewer or smaller files at a time.' : `Upload failed (HTTP ${xhr.status}).` };
      }
      setMsg({ ok: !!body.ok, text: [...notes, body.message ?? body.error ?? ''].join(' ') });
      if (body.ok) {
        setFiles([]);
        router.refresh();
      }
    };
    xhr.onerror = () => {
      setPct(null);
      setMsg({ ok: false, text: 'Network error during upload.' });
    };
    xhr.send(fd);
  }

  return (
    <form ref={form} onSubmit={submit} className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center text-sm ${over ? 'border-gold bg-gold/10' : 'border-line'}`}
      >
        <p className="text-muted">{labels.drop}</p>
        <label className="btn-outline mt-3 inline-block cursor-pointer py-1.5 text-sm">
          {labels.choose}
          <input type="file" multiple accept={accept} className="sr-only" onChange={(e) => add(e.target.files)} />
        </label>
        {files.length > 0 && (
          <ul className="mx-auto mt-3 max-w-md space-y-1 text-left text-xs">
            {files.map((f, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 font-mono text-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
      {pct !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-maroon transition-all dark:bg-gold" style={{ width: `${pct}%` }} />
        </div>
      )}
      <button className="btn-primary py-2" disabled={!files.length || pct !== null}>
        {pct !== null ? `${pct}%` : `${labels.upload} (${files.length})`}
      </button>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200'}`}>{msg.text}</p>}
    </form>
  );
}
