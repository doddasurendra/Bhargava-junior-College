'use client';

import './guide.css';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { finishGuideSessionAction, saveGuideAnswersAction } from '@/app/(site)/parent-counselling/actions';
import { GUIDE_LANG_COOKIE, GUIDE_LANGS, STEP_COUNT, type Answers, type GuideContent, type GuideLang, type GuideSettings } from '@/lib/parentCounselling/content';

export type GuideMode = 'public' | 'counsellor' | 'print';
export type GuideSessionView = { id: string; leadLabel: string; answers: Answers; ended: boolean };

const C = {
  navy: '#0F2142', yellow: '#FFE27A', gold: '#B88A1E', blue: '#1565E6', red: '#C8261C', orange: '#C8591A',
  green: '#0B7A33', teal: '#0E6B78', purple: '#5B2A6E', grey: '#5A6475',
};
const STEP_COLOR: Record<number, string> = { 1: C.navy, 2: C.blue, 3: C.gold, 4: C.red, 5: C.orange, 6: C.green, 7: C.teal, 8: C.teal, 9: C.navy, 10: C.red };
const INDEX_COLOR: Record<number, string> = { ...STEP_COLOR, 8: C.purple };
const WHO_COLOR = { student: C.blue, both: C.gold, parents: C.red } as const;
const TAG_COLOR = { tell: C.green, ask: C.blue } as const;
type Who = keyof typeof WHO_COLOR;
type Tag = keyof typeof TAG_COLOR;

/* ------------------------------------------------------------------ state */

type Ctx = { a: Answers; set: (k: string, v: unknown) => void; editable: boolean; c: GuideContent; settings: GuideSettings; flash: (m: string) => void };
const GuideCtx = createContext<Ctx | null>(null);
const useG = () => useContext(GuideCtx)!;

function Check({ id, label, limit }: { id: string; label: ReactNode; limit?: { prefix: string; max: number } }) {
  const { a, set, editable, c, flash } = useG();
  const on = a[id] === true;
  return (
    <label className="bpc-check">
      <input
        type="checkbox"
        checked={on}
        disabled={!editable}
        onChange={(e) => {
          if (e.target.checked && limit) {
            const n = Object.keys(a).filter((k) => k.startsWith(limit.prefix) && a[k] === true).length;
            if (n >= limit.max) { flash(c.ui.app.upToTwo); return; }
          }
          set(id, e.target.checked);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

/** Looks like a checkbox (as in the PDF) but allows one choice in its group. */
function Radio({ group, idx, label }: { group: string; idx: number; label: ReactNode }) {
  const { a, set, editable } = useG();
  const on = a[group] === String(idx);
  return (
    <label className="bpc-check">
      <input type="checkbox" role="radio" aria-checked={on} checked={on} disabled={!editable} onChange={() => set(group, on ? null : String(idx))} />
      <span>{label}</span>
    </label>
  );
}

function Line({ id, label, type = 'text' }: { id: string; label?: ReactNode; type?: 'text' | 'date' | 'time' }) {
  const { a, set, editable } = useG();
  const v = typeof a[id] === 'string' ? (a[id] as string) : '';
  return (
    <label className="bpc-line">
      {label && <span>{label}</span>}
      <input type={type} value={v} disabled={!editable} maxLength={400} onChange={(e) => set(id, e.target.value)} />
    </label>
  );
}

/** An inline blank: the admin's value when set, otherwise a fill-in. */
function Blank({ id, value }: { id: string; value: string | null }) {
  const { a, set, editable, c } = useG();
  if (value) return <strong className="bpc-filled">{value}</strong>;
  const v = typeof a[id] === 'string' ? (a[id] as string) : '';
  return <input className="bpc-inline" aria-label={c.ui.app.pending} title={c.ui.app.pending} value={v} disabled={!editable} maxLength={200} onChange={(e) => set(id, e.target.value)} />;
}

/* ------------------------------------------------------------------ building blocks */

function Frame({ footer, pageNo, children }: { footer: string; pageNo: number; children: ReactNode }) {
  const { c } = useG();
  return (
    <section className="bpc-page" aria-label={footer}>
      <header className="bpc-head">
        <span className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-64.png" alt="" />
          {c.ui.brand}
        </span>
        <span className="right">{c.ui.guideName}</span>
      </header>
      <div className="bpc-body">{children}</div>
      <footer className="bpc-foot">
        <span>{footer}</span>
        <span className="pg">{c.ui.forCounsellor} | {String(pageNo).padStart(2, '0')}</span>
      </footer>
    </section>
  );
}

function H({ children, pill, pillColor = C.navy }: { children: ReactNode; pill?: string; pillColor?: string }) {
  return (
    <div className="bpc-h">
      <h3>{children}</h3>
      <span className="rule" />
      {pill && <span className="bpc-pill" style={{ background: pillColor }}>{pill}</span>}
    </div>
  );
}

function Quote({ q, color }: { q: { tag: string; text: string }; color?: string }) {
  const { c } = useG();
  const tag = (q.tag === 'ask' ? 'ask' : 'tell') as Tag;
  const col = color ?? TAG_COLOR[tag];
  const quoted = /^[“"]/.test(q.text) || q.text.includes('“');
  return (
    <div className="bpc-quote" style={{ borderLeftColor: col }}>
      <span className="bpc-tag" style={{ background: TAG_COLOR[tag] }}>{c.ui[tag]}</span>
      {quoted ? <span className="qt">{q.text}</span> : <q>{q.text}</q>}
    </div>
  );
}

function Tip({ tip }: { tip: { lead: string; text: string } }) {
  return (
    <div className="bpc-tip">
      <b>{tip.lead}</b> {tip.text}
    </div>
  );
}

function Banner({ n }: { n: number }) {
  const { c } = useG();
  const s = c.steps[String(n) as keyof GuideContent['steps']];
  const col = STEP_COLOR[n];
  return (
    <div className="bpc-banner" style={{ background: col }}>
      <span className="bpc-num" style={{ color: col }}>{n}</span>
      <div>
        <div className="of">{c.ui.stepOf.replace('{n}', String(n))}</div>
        <h2>{s.title}</h2>
        <p>{s.sub}</p>
      </div>
      <div className="bpc-bpills">
        <span>{c.ui.whoPrefix} {c.ui.who[s.who as Who]}</span>
        <span>{s.min} {c.ui.minUnit}</span>
        <span>{s.brochure}</span>
      </div>
    </div>
  );
}

function Chevrons({ items, colors, cls, big }: { items: { t: string; s: string }[]; colors: string[]; cls: string; big?: boolean }) {
  return (
    <div className={cls}>
      {items.map((it, i) => (
        <div key={i} className="bpc-chev" style={{ background: colors[i] }}>
          {big ? <span className="bpc-big">{it.t}</span> : <b>{it.t}</b>}
          <small>{it.s}</small>
        </div>
      ))}
    </div>
  );
}

function WorriesChip() {
  const { a, c } = useG();
  const w = c.steps['1'].worries.filter((_, i) => a[`s1.w.${i}`] === true);
  return (
    <div className="bpc-chip">
      <b>{c.ui.app.worriesChip}:</b>
      {w.length ? w.map((x) => <span key={x}>{x}</span>) : <em>{c.ui.app.noWorries}</em>}
    </div>
  );
}

/* ------------------------------------------------------------------ pages */

function Cover({ go }: { go: (n: number) => void }) {
  const { c } = useG();
  const v = c.cover;
  const phaseColors = [C.navy, C.red, C.green, C.purple];
  return (
    <Frame footer={v.footer} pageNo={1}>
      <div className="bpc-cover">
        <div>
          <div className="bpc-kicker">{v.kicker}</div>
          <h1 className="bpc-serif">{v.title1}<span>{v.title2}</span></h1>
          <p>{v.sub1}<br />{v.sub2}</p>
        </div>
        <div className="bpc-crest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Bhargava crest" />
        </div>
      </div>
      <H>{v.introH}</H>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65 }}>{v.intro}</p>
      <div className="bpc-phases">
        {v.phases.map((p, i) => (
          <div key={i} className="bpc-chev" style={{ background: phaseColors[i] }}>
            <b>{p.word}</b>
            <small>{p.steps}</small>
          </div>
        ))}
      </div>
      <div className="bpc-index-head">
        <h2 className="bpc-serif">{v.indexH}</h2>
        <span className="bpc-pill">{v.duration}</span>
      </div>
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead>
            <tr>{v.cols.map((h, i) => <th key={i} className={i >= 3 ? 'c' : undefined}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {v.rows.map((r, i) => (
              <tr key={i} className="link" onClick={() => go(i + 1)}>
                <td style={{ width: 52 }}><span className="bpc-circle" style={{ background: INDEX_COLOR[i + 1] }}>{i + 1}</span></td>
                <td>
                  <a className="rowlink" href={`#step-${i + 1}`} onClick={(e) => { e.preventDefault(); go(i + 1); }}>
                    <b>{r.title}</b> <span style={{ color: C.grey }}>{r.desc}</span>
                  </a>
                </td>
                <td><span className="bpc-badge" style={{ background: WHO_COLOR[r.who as Who] }}>{c.ui.who[r.who as Who]}</span></td>
                <td className="c">{r.min}</td>
                <td className="c">{r.page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H>{v.guideH}</H>
      <div className="bpc-dodont">
        <div>
          <h4 style={{ background: C.green }}>✓ {v.doH}</h4>
          <ul>{v.do.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div>
          <h4 style={{ background: C.red }}>✕ {v.dontH}</h4>
          <ul>{v.dont.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      </div>
      <div className="bpc-meta">
        <Line id="c.f.0" label={v.fields[0]} type="date" />
        <Line id="c.f.1" label={v.fields[1]} />
        <Line id="c.f.2" label={v.fields[2]} />
      </div>
    </Frame>
  );
}

function Step1() {
  const s = useG().c.steps['1'];
  return (
    <Frame footer={s.footer} pageNo={2}>
      <Banner n={1} />
      <Quote q={s.open} />
      <H>{s.detailsH}</H>
      <div className="bpc-g3">{s.fields.map((f, i) => <Line key={i} id={`s1.f.${i}`} label={f} />)}</div>
      <div className="bpc-g3">
        {s.choices.map((g, gi) => (
          <div key={gi} className="bpc-box">
            <div className="q">{g.label}</div>
            <div className="bpc-opts">{g.opts.map((o, oi) => <Radio key={oi} group={`s1.ch.${gi}`} idx={oi} label={o} />)}</div>
          </div>
        ))}
      </div>
      <H>{s.kidsH}</H>
      <div className="bpc-g2">
        {s.kidQs.map((q, qi) => (
          <div key={qi} className="bpc-box">
            <div className="q">{q.q}</div>
            <div className="bpc-opts">{q.opts.map((o, oi) => <Check key={oi} id={`s1.k.${qi}.${oi}`} label={o} />)}</div>
          </div>
        ))}
      </div>
      <H>{s.parentsH}</H>
      <div className="bpc-box">
        <div className="q">{s.worriesQ}</div>
        <div className="bpc-opts">{s.worries.map((o, i) => <Check key={i} id={`s1.w.${i}`} label={o} limit={{ prefix: 's1.w.', max: 2 }} />)}</div>
      </div>
      <div className="bpc-g2">{s.worryLines.map((l, i) => <Line key={i} id={`s1.wl.${i}`} label={l} />)}</div>
      <Tip tip={s.tip} />
    </Frame>
  );
}

function Step2() {
  const s = useG().c.steps['2'];
  return (
    <Frame footer={s.footer} pageNo={3}>
      <Banner n={2} />
      <Quote q={s.open} />
      <H>{s.likesH}</H>
      <div className="bpc-g2">
        {s.boxes.map((b, bi) => (
          <div key={bi} className="bpc-box">
            <div className="q">{b.q}</div>
            <div className="bpc-opts">{b.opts.map((o, oi) => <Check key={oi} id={`s2.b.${bi}.${oi}`} label={o} />)}</div>
          </div>
        ))}
      </div>
      <H>{s.dreamH}</H>
      <div className="bpc-g2">
        <div className="bpc-box">
          <div className="q">{s.dream.q}</div>
          <div className="bpc-opts">{s.dream.opts.map((o, i) => <Check key={i} id={`s2.d.${i}`} label={o} />)}</div>
        </div>
        <div className="bpc-box">
          <div className="q">{s.why.q}</div>
          <div className="bpc-opts">{s.why.opts.map((o, i) => <Check key={i} id={`s2.y.${i}`} label={o} />)}</div>
        </div>
      </div>
      <div className="bpc-g2">{s.lines.map((l, i) => <Line key={i} id={`s2.l.${i}`} label={l} />)}</div>
      <div className="bpc-card" style={{ borderLeft: `5px solid ${C.blue}` }}>
        <Quote q={s.askCard} />
        <div style={{ marginTop: 10 }}><Line id="s2.pw" label={s.askCard.line} /></div>
      </div>
      <Quote q={s.close} />
      <Tip tip={s.tip} />
    </Frame>
  );
}

function Step3() {
  const s = useG().c.steps['3'];
  const cardColors = [C.navy, C.orange, C.green, C.red];
  const icons = ['📝', '🔁', '🧱', '💪'];
  return (
    <Frame footer={s.footer} pageNo={4}>
      <Banner n={3} />
      <Quote q={s.open} />
      <Chevrons items={s.chevrons} colors={[C.navy, C.orange, C.red, C.green, C.purple]} cls="bpc-steps5" />
      <H>{s.whyH}</H>
      <div className="bpc-g2">
        {s.cards.map((cd, i) => (
          <div key={i} className="bpc-icon-card" style={{ borderTopColor: cardColors[i] }}>
            <span className="ic" aria-hidden>{icons[i]}</span>
            <b style={{ color: cardColors[i] }}>{cd.t}</b>
            <p>{cd.d}</p>
          </div>
        ))}
      </div>
      <H>{s.pathsH}</H>
      <div className="bpc-g2">
        {[{ p: s.bad, col: C.red, bg: '#fdecea' }, { p: s.good, col: C.green, bg: '#e6f4ea' }].map(({ p, col, bg }, k) => (
          <div key={k} className="bpc-path" style={{ borderColor: col }}>
            <div className="top" style={{ background: col }}><small>{p.k}</small><b>{p.t}</b></div>
            <ol>{p.steps.map((x, i) => <li key={i}><span className="bpc-circle" style={{ background: col, width: 22, height: 22, fontSize: 11 }}>{i + 1}</span>{x}</li>)}</ol>
            <div className="bot" style={{ background: bg, color: col }}>{p.foot}</div>
          </div>
        ))}
      </div>
      <div className="bpc-box">
        <div className="q">{s.decide.q}</div>
        <div className="bpc-opts">{s.decide.opts.map((o, i) => <Check key={i} id={`s3.dec.${i}`} label={o} />)}</div>
      </div>
      <Quote q={s.close} />
    </Frame>
  );
}

function Step4() {
  const { c, settings } = useG();
  const s = c.steps['4'];
  const tokens: Record<string, string | null> = { calls: settings.calls, visits: settings.visits, progress: settings.progress, medical: settings.medical, laundry: settings.laundry };
  const withBlanks = (t: string) =>
    t.split(/(\{\w+\})/).map((part, i) => {
      const m = /^\{(\w+)\}$/.exec(part);
      return m ? <Blank key={i} id={`s4.b.${m[1]}`} value={tokens[m[1]] ?? null} /> : <span key={i}>{part}</span>;
    });
  return (
    <Frame footer={s.footer} pageNo={5}>
      <Banner n={4} />
      <Quote q={s.open} />
      <H pill={s.worriesPill} pillColor={C.red}>{s.worriesH}</H>
      <div className="bpc-g4">
        {s.tiles.map((t, i) => <div key={i} className="bpc-box"><Check id={`s4.t.${i}`} label={t} /></div>)}
      </div>
      <H pill={s.carePill} pillColor={C.red}>{s.careH}</H>
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead><tr>{s.careCols.map((h, i) => <th key={i} className={i === 2 ? 'c' : undefined} style={{ background: C.red }}>{h}</th>)}</tr></thead>
          <tbody>
            {s.care.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, width: '38%' }}>{r.q}</td>
                <td>{withBlanks(r.a)}</td>
                <td className="c"><Check id={`s4.c.${i}`} label={<span className="sr-only">{s.careCols[2]}</span>} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Quote q={s.close} />
      <Tip tip={s.tip} />
    </Frame>
  );
}

function QA({ x, head, labels }: { x: GuideContent['steps']['5']['jee']; head: string; labels: GuideContent['steps']['5']['labels'] }) {
  return (
    <div className="bpc-path">
      <div className="top" style={{ background: head }}><b>{x.h}</b></div>
      <div className="bpc-qa" style={{ padding: 12 }}>
        <p style={{ fontWeight: 700 }}>{x.q}</p>
        <span className="lbl" style={{ color: C.red }}>{labels.common}</span>
        <p>{x.common}</p>
        <span className="lbl" style={{ color: C.green }}>{labels.right}</span>
        <p>{x.rightIntro}</p>
        <ol>{x.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
        <span className="lbl" style={{ color: C.grey }}>{labels.why}</span>
        <p>{x.why}</p>
        <p><b style={{ color: head }}>{labels.how}</b> {x.how}</p>
      </div>
    </div>
  );
}

function Step5() {
  const s = useG().c.steps['5'];
  return (
    <Frame footer={s.footer} pageNo={6}>
      <Banner n={5} />
      <Quote q={s.open} />
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead><tr>{s.cmpCols.map((h, i) => <th key={i} style={i === 2 ? { background: C.green } : i === 1 ? { background: C.red } : undefined}>{h}</th>)}</tr></thead>
          <tbody>{s.cmp.map((r, i) => <tr key={i}><td style={{ fontWeight: 700 }}>{r[0]}</td><td>{r[1]}</td><td style={{ color: C.green, fontWeight: 600 }}>{r[2]}</td></tr>)}</tbody>
        </table>
      </div>
      <H pill={s.askPill} pillColor={C.orange}>{s.askH}</H>
      <div className="bpc-g2">
        <QA x={s.jee} head={C.navy} labels={s.labels} />
        <QA x={s.neet} head={C.green} labels={s.labels} />
      </div>
      <div className="bpc-box">
        <div className="q">{s.react.q}</div>
        <div className="bpc-opts">{s.react.opts.map((o, i) => <Check key={i} id={`s5.r.${i}`} label={o} />)}</div>
      </div>
      <Tip tip={s.tip} />
    </Frame>
  );
}

const Wilting = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
    <rect x="18" y="46" width="28" height="12" rx="2" fill="#8a5a3c" />
    <path d="M32 46 C32 36 30 30 24 26" stroke="#7d8b4a" strokeWidth="3" fill="none" />
    <path d="M24 26 C18 26 14 30 13 36 C19 36 23 32 24 26Z" fill="#a3a35a" />
    <path d="M31 38 C36 36 40 38 42 44 C37 44 33 42 31 38Z" fill="#b6a35a" />
    <path d="M10 14 L14 18 M52 12 L48 17 M30 6 L30 12" stroke="#C8261C" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const Growing = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
    <circle cx="50" cy="13" r="7" fill="#FFC93C" />
    <rect x="18" y="46" width="28" height="12" rx="2" fill="#8a5a3c" />
    <path d="M32 46 L32 18" stroke="#0B7A33" strokeWidth="3" />
    <path d="M32 30 C24 30 18 25 17 18 C25 18 31 23 32 30Z" fill="#1f9a4c" />
    <path d="M32 24 C40 24 46 19 47 12 C39 12 33 17 32 24Z" fill="#26b35a" />
    <path d="M32 38 C39 38 44 34 45 28 C38 28 33 32 32 38Z" fill="#1f9a4c" />
  </svg>
);

function Step6() {
  const s = useG().c.steps['6'];
  return (
    <Frame footer={s.footer} pageNo={7}>
      <Banner n={6} />
      <WorriesChip />
      <Quote q={s.open} />
      <div className="bpc-g2">
        <div className="bpc-env" style={{ borderColor: C.red }}><Wilting /><div><b style={{ color: C.red }}>{s.wrong.t}</b><p>{s.wrong.d}</p></div></div>
        <div className="bpc-env" style={{ borderColor: C.green }}><Growing /><div><b style={{ color: C.green }}>{s.right.t}</b><p>{s.right.d}</p></div></div>
      </div>
      <H>{s.needH}</H>
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead><tr>{s.needCols.map((h, i) => <th key={i} className={i === 2 ? 'c' : undefined} style={{ background: C.green }}>{h}{i === 2 ? ' ☐' : ''}</th>)}</tr></thead>
          <tbody>{s.need.map((r, i) => <tr key={i}><td className="bpc-say" style={{ color: C.green }}>{r[0]}</td><td>{r[1]}</td><td className="c"><Check id={`s6.n.${i}`} label={<span className="sr-only">{s.needCols[2]}</span>} /></td></tr>)}</tbody>
        </table>
      </div>
      <div className="bpc-g3">
        {s.tiles.map((t, i) => <div key={i} className="bpc-tile" style={{ background: [C.navy, C.red, C.green][i] }}><b>{t.t}</b><span>{t.d}</span></div>)}
      </div>
      <Quote q={s.close} />
    </Frame>
  );
}

const EVOLVE = ['Explore', 'Validate', 'Optimize', 'Learn', 'Verify', 'Excel'];
const EVOLVE_COLORS = [C.blue, C.green, C.orange, C.red, C.purple, C.gold];

function Step7() {
  const s = useG().c.steps['7'];
  return (
    <Frame footer={s.footer} pageNo={8}>
      <Banner n={7} />
      <WorriesChip />
      <Quote q={s.open} />
      <H pill={s.cyclePill} pillColor={C.teal}>{s.cycleH}</H>
      <Chevrons items={s.cycle.map((cap, i) => ({ t: EVOLVE[i][0], s: cap }))} colors={EVOLVE_COLORS} cls="bpc-steps6" big />
      <H>{s.chapterH}</H>
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead><tr>{s.chapterCols.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {s.chapter.map((r, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }}><span className="bpc-circle" style={{ background: EVOLVE_COLORS[i], marginRight: 6 }}>{EVOLVE[i][0]}</span><b>{EVOLVE[i]}</b></td>
                <td>{r[0]}</td>
                <td>{r[1]}</td>
                <td className="bpc-say" style={{ color: EVOLVE_COLORS[i] }}>{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bpc-box">
        <div className="q">{s.missQ}</div>
        <div className="bpc-opts">{EVOLVE.map((o, i) => <Check key={i} id={`s7.m.${i}`} label={o} />)}</div>
      </div>
      <div className="bpc-g3">
        {s.pills.map((p, i) => <div key={i} className="bpc-tile" style={{ background: [C.teal, C.purple, C.navy][i], borderRadius: 999 }}><b>{p.t}</b><span>{p.d}</span></div>)}
      </div>
      <Tip tip={s.tip} />
    </Frame>
  );
}

function Step8() {
  const s = useG().c.steps['8'];
  const icons = ['🏠', '🍲', '🛡️', '⚽', '🔬', '💬'];
  return (
    <Frame footer={s.footer} pageNo={9}>
      <Banner n={8} />
      <WorriesChip />
      <Quote q={s.open} />
      <div className="bpc-card" style={{ background: C.navy, color: '#fff', borderColor: C.navy }}>
        <b style={{ fontSize: 16 }}>{s.feature}</b>
        <div className="bpc-g2" style={{ marginTop: 10 }}>
          {s.halves.map((h, i) => (
            <div key={i} style={{ background: i ? C.orange : C.teal, borderRadius: 8, padding: '10px 12px' }}>
              <small style={{ display: 'block', fontWeight: 800, letterSpacing: '.1em', fontSize: 11, color: C.yellow }}>{h.k}</small>
              <b>{h.d}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead><tr>{s.doubtCols.map((h, i) => <th key={i} style={{ background: C.teal }}>{h}</th>)}</tr></thead>
          <tbody>{s.doubts.map((r, i) => <tr key={i}><td style={{ fontWeight: 700, width: '35%' }}>{r[0]}</td><td>{r[1]}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="bpc-g4">
        {s.stats.map((st, i) => <div key={i} className="bpc-stat" style={{ background: [C.red, C.navy, C.purple, C.orange][i] }}><b>{st.v}</b><span>{st.l}</span></div>)}
      </div>
      <H pill={s.hostelPill} pillColor={C.teal}>{s.hostelH}</H>
      <div className="bpc-g3">
        {s.cards.map((cd, i) => (
          <div key={i} className="bpc-icon-card" style={{ borderTopColor: [C.teal, C.orange, C.navy, C.green, C.purple, C.red][i] }}>
            <span className="ic" aria-hidden>{icons[i]}</span>
            <b>{cd.t}</b>
            <p>{cd.d}</p>
          </div>
        ))}
      </div>
      <div className="bpc-box">
        <div className="q">{s.stay.q}</div>
        <div className="bpc-opts">{s.stay.opts.map((o, i) => <Check key={i} id={`s8.st.${i}`} label={o} />)}</div>
      </div>
      <Quote q={s.close} />
    </Frame>
  );
}

function Step9() {
  const { c, settings } = useG();
  const s = c.steps['9'];
  const feeKeys: { k: keyof typeof s.fees; v: string | null }[] = [
    { k: 'tuition', v: settings.tuition }, { k: 'hostel', v: settings.hostelFee }, { k: 'scholarship', v: settings.scholarship },
    { k: 'schedule', v: settings.schedule }, { k: 'visiting', v: settings.visiting }, { k: 'lastDate', v: settings.lastDate },
  ];
  return (
    <Frame footer={s.footer} pageNo={10}>
      <Banner n={9} />
      <Quote q={s.open} />
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead><tr>{s.courseCols.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{s.courses.map((r, i) => <tr key={i}><td style={{ fontWeight: 700 }}>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
        </table>
      </div>
      <H>{s.faqH}</H>
      <div className="bpc-scroll">
        <table className="bpc-table">
          <thead><tr>{s.faqCols.map((h, i) => <th key={i} className={i === 2 ? 'c' : undefined} style={{ background: C.blue }}>{h}</th>)}</tr></thead>
          <tbody>{s.faq.map((r, i) => <tr key={i}><td style={{ fontWeight: 600, width: '34%' }}>{r.q}</td><td>{r.a}</td><td className="c"><Check id={`s9.f.${i}`} label={<span className="sr-only">{s.faqCols[2]}</span>} /></td></tr>)}</tbody>
        </table>
      </div>
      <H pill={s.feesPill} pillColor={C.red}>{s.feesH}</H>
      <div className="bpc-g2">
        {feeKeys.map(({ k, v }) => (
          <div key={k} className="bpc-line">
            <span>{s.fees[k]}</span>
            {v ? <strong className="bpc-filled">{v}</strong> : <FeeInput id={`s9.fee.${k}`} />}
          </div>
        ))}
      </div>
      <div className="bpc-quote" style={{ borderLeftColor: C.red }}>
        <span className="bpc-tag" style={{ background: C.red }}>{s.noteTag}</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{s.note}</span>
          <Line id="s9.note" />
        </div>
      </div>
    </Frame>
  );
}

function FeeInput({ id }: { id: string }) {
  const { a, set, editable, c } = useG();
  const v = typeof a[id] === 'string' ? (a[id] as string) : '';
  return <input aria-label={c.ui.app.pending} placeholder={editable ? '' : c.ui.app.pending} value={v} disabled={!editable} maxLength={200} onChange={(e) => set(id, e.target.value)} style={{ flex: 1, minWidth: 0, border: 0, borderBottom: '1.5px solid #9aa2b1', background: 'transparent', font: 'inherit', fontSize: 13 }} />;
}

function Step10({ countdown }: { countdown: ReactNode }) {
  const s = useG().c.steps['10'];
  return (
    <Frame footer={s.footer} pageNo={11}>
      <Banner n={10} />
      <Quote q={s.open} />
      <H>{s.summaryH}</H>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{s.summary.map((l, i) => <Line key={i} id={`s10.sum.${i}`} label={`${i + 1}. ${l}`} />)}</div>
      <Quote q={s.ask} />
      <div className="bpc-box">
        <div className="q">{s.nextH}</div>
        <div className="bpc-opts">{s.next.map((o, i) => <Check key={i} id={`s10.next.${i}`} label={o} />)}</div>
        <div className="bpc-g3" style={{ marginTop: 10 }}>
          <Line id="s10.nf.0" label={s.nextFields[0]} type="date" />
          <Line id="s10.nf.1" label={s.nextFields[1]} type="time" />
          <Line id="s10.nf.2" label={s.nextFields[2]} />
        </div>
      </div>
      <H>{s.leaveH}</H>
      <div className="bpc-g2">{s.leave.map((l, i) => <Check key={i} id={`s10.lv.${i}`} label={l} />)}</div>
      <Quote q={s.close} />
      <H pill={s.recordPill} pillColor={C.red}>{s.recordH}</H>
      {countdown}
      <div className="bpc-g2">
        <div className="bpc-box" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><div className="q">{s.interestL}</div><div className="bpc-opts">{s.interest.map((o, i) => <Radio key={i} group="s10.int" idx={i} label={o} />)}</div></div>
          <Line id="s10.follow" label={s.followL} type="date" />
          <Line id="s10.outcome" label={s.outcomeL} />
        </div>
        <div className="bpc-box">
          <div className="q">{s.selfL}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{s.self.map((l, i) => <Check key={i} id={`s10.self.${i}`} label={l} />)}</div>
        </div>
      </div>
    </Frame>
  );
}

const PAGES = [Step1, Step2, Step3, Step4, Step5, Step6, Step7, Step8, Step9];

/* ------------------------------------------------------------------ app */

function pathFor(n: number) {
  return n === 0 ? '/parent-counselling' : `/parent-counselling/step-${n}`;
}
function pageFromPath(p: string) {
  const m = /\/parent-counselling\/step-(\d+)/.exec(p);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= STEP_COUNT ? n : 0;
}

export function GuideApp(props: { lang: GuideLang; c: GuideContent; settings: GuideSettings; mode: GuideMode; session: GuideSessionView | null; initialPage: number; pdfUrl: string; query: string }) {
  const { lang, c, settings, mode, session, pdfUrl, query } = props;
  const [page, setPage] = useState(props.initialPage);
  const [a, setA] = useState<Answers>(session?.answers ?? {});
  const [ended, setEnded] = useState(Boolean(session?.ended));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const editable = mode === 'counsellor' && Boolean(session) && !ended;
  const dirty = useRef(false);
  const latest = useRef(a);
  latest.current = a;

  const set = useCallback((k: string, v: unknown) => {
    dirty.current = true;
    setA((prev) => ({ ...prev, [k]: v }));
  }, []);
  const flash = useCallback((m: string) => setMsg({ text: m, err: true }), []);

  // Autosave (debounced), with retry.
  const save = useCallback(async () => {
    if (!session || !dirty.current) return true;
    dirty.current = false;
    setStatus('saving');
    const res = await saveGuideAnswersAction(session.id, latest.current, lang);
    if (!res.ok) { dirty.current = true; setStatus('error'); return false; }
    setStatus('saved');
    return true;
  }, [session, lang]);
  useEffect(() => {
    if (!editable || !dirty.current) return;
    const t = window.setTimeout(() => { void save(); }, 800);
    return () => window.clearTimeout(t);
  }, [a, editable, save]);
  useEffect(() => {
    if (status !== 'error') return;
    const t = window.setTimeout(() => { void save(); }, 3000);
    return () => window.clearTimeout(t);
  }, [status, save]);

  // Visited steps + minutes per step.
  useEffect(() => {
    if (!editable) return;
    setA((prev) => {
      const visited = Array.isArray(prev._visited) ? (prev._visited as number[]) : [];
      const patch: Answers = {};
      if (page && !visited.includes(page)) patch._visited = [...visited, page];
      if (page === 10 && typeof prev._s10at !== 'number') patch._s10at = Date.now();
      if (!Object.keys(patch).length) return prev;
      dirty.current = true;
      return { ...prev, ...patch };
    });
  }, [page, editable]);
  useEffect(() => {
    if (!editable || !page) return;
    let secs = 0;
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      secs += 1;
      setNow(Date.now());
      if (secs % 15 === 0) {
        setA((prev) => {
          const all = (prev._secs && typeof prev._secs === 'object' ? prev._secs : {}) as Record<string, number>;
          dirty.current = true;
          return { ...prev, _secs: { ...all, [page]: (all[page] ?? 0) + 15 } };
        });
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [page, editable]);

  // Client-side page changes keep the answers in memory; the URL follows.
  const go = useCallback((n: number) => {
    setPage(n);
    window.history.pushState(null, '', `${pathFor(n)}${query}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [query]);
  useEffect(() => {
    const onPop = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    try { document.cookie = `${GUIDE_LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`; } catch { /* ignore */ }
  }, [lang]);
  useEffect(() => {
    if (mode !== 'print') return;
    const t = window.setTimeout(() => window.print(), 900);
    return () => window.clearTimeout(t);
  }, [mode]);

  const langHref = (code: GuideLang) => {
    const q = new URLSearchParams(query.replace(/^\?/, ''));
    q.set('lang', code);
    return `${mode === 'print' ? '/parent-counselling/print' : pathFor(page)}?${q.toString()}`;
  };
  const switchLang = async (e: React.MouseEvent, code: GuideLang) => {
    e.preventDefault();
    if (editable) await save();
    window.location.assign(langHref(code));
  };

  const finish = async () => {
    if (!session) return;
    setStatus('saving');
    const res = await finishGuideSessionAction(session.id, latest.current);
    setStatus(res.ok ? 'saved' : 'error');
    if (res.ok) { setEnded(true); dirty.current = false; setMsg({ text: [c.ui.app.finished, ...res.notes].join(' ') }); }
    else setMsg({ text: res.error ?? 'Error', err: true });
  };

  const visited = Array.isArray(a._visited) ? (a._visited as number[]) : [];
  const secs = (a._secs && typeof a._secs === 'object' ? a._secs : {}) as Record<string, number>;
  const stepMin = page ? Number(c.steps[String(page) as keyof GuideContent['steps']].min) : 0;
  const usedMin = page ? Math.floor((secs[page] ?? 0) / 60) : 0;
  const s10at = typeof a._s10at === 'number' ? (a._s10at as number) : null;
  const leftMs = s10at ? s10at + 10 * 60_000 - now : null;
  const countdown = mode === 'counsellor' && session && !ended && leftMs !== null ? (
    <div className="bpc-chip bpc-noprint" style={{ background: leftMs < 0 ? '#fdecea' : undefined }}>
      <b>{c.ui.app.closeWithin}</b>
      {leftMs >= 0 ? <em>{c.ui.app.timeLeft}: {Math.floor(leftMs / 60000)}:{String(Math.floor((leftMs % 60000) / 1000)).padStart(2, '0')}</em> : <span>{c.ui.app.overdue}</span>}
    </div>
  ) : null;

  const ctx: Ctx = { a, set, editable, c, settings, flash };
  const all = mode === 'print';
  const pageEl = (n: number) => (n === 0 ? <Cover key={0} go={go} /> : n === 10 ? <Step10 key={10} countdown={countdown} /> : (() => { const P = PAGES[n - 1]; return <P key={n} />; })());

  return (
    <GuideCtx.Provider value={ctx}>
      {/* Fonts used by the PDF */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=Lora:ital,wght@0,600;0,700;1,500&family=Noto+Sans+Telugu:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap" />
      <div className="bpc-root" data-lang={lang} lang={lang}>
        <div className="bpc-toolbar bpc-noprint">
          <nav className="bpc-langs" aria-label={c.ui.app.language}>
            {GUIDE_LANGS.map((l) => (
              <a key={l.code} href={langHref(l.code)} aria-current={l.code === lang} onClick={(e) => switchLang(e, l.code)}>{l.label}</a>
            ))}
          </nav>
          <div className="bpc-actions">
            {mode === 'public' && (
              <>
                <a className="bpc-btn" href={pdfUrl} download>⬇ {c.ui.app.downloadPdf}</a>
                <a className="bpc-btn" href="/visit">{c.ui.app.bookVisit}</a>
                <a className="bpc-btn bpc-btn-primary" href="/contact">{c.ui.app.talkCounsellor}</a>
              </>
            )}
            {mode === 'counsellor' && session && (
              <>
                <span className="bpc-status" aria-live="polite">{status === 'saving' ? c.ui.app.saving : status === 'saved' ? `✓ ${c.ui.app.saved}` : status === 'error' ? c.ui.app.saveError : ''}</span>
                <a className="bpc-btn" href={`/parent-counselling/print${query}`} target="_blank" rel="noopener">🖨 {c.ui.app.print}</a>
                {!ended && <button type="button" className="bpc-btn bpc-btn-green" onClick={finish}>{c.ui.app.finishSession}</button>}
              </>
            )}
            {mode === 'print' && <button type="button" className="bpc-btn bpc-btn-primary" onClick={() => window.print()}>🖨 {c.ui.app.print}</button>}
          </div>
        </div>
        {mode === 'public' && <p className="bpc-note bpc-noprint">{c.ui.app.readOnly}</p>}
        {mode === 'counsellor' && session && <p className="bpc-note bpc-noprint"><b>{c.ui.app.counsellorMode}</b> · {c.ui.app.sessionFor} {session.leadLabel}</p>}
        {msg && <div className={`bpc-flash bpc-noprint${msg.err ? ' err' : ''}`} role="status" onClick={() => setMsg(null)}>{msg.text}</div>}
        {mode === 'counsellor' && session && (
          <>
            <div className="bpc-progress bpc-noprint" role="navigation" aria-label="Steps">
              {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" data-visited={visited.includes(n)} aria-current={page === n ? 'step' : undefined} onClick={() => go(n)}>{n}</button>
              ))}
            </div>
            {page > 0 && (
              <div className="bpc-timer bpc-noprint">
                <span>Step {page}: <strong className={usedMin > stepMin ? 'over' : undefined}>{c.ui.app.minutesOf.replace('{a}', String(usedMin)).replace('{b}', String(stepMin))}</strong></span>
              </div>
            )}
          </>
        )}
        {all ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{Array.from({ length: STEP_COUNT + 1 }, (_, n) => pageEl(n))}</div>
        ) : (
          pageEl(page)
        )}
        {!all && (
          <div className="bpc-pager bpc-noprint">
            {page > 0 ? <button type="button" className="bpc-btn" onClick={() => go(page - 1)}>{c.ui.app.prev}</button> : <span />}
            {page < STEP_COUNT ? <button type="button" className="bpc-btn bpc-btn-primary" onClick={() => go(page + 1)}>{c.ui.app.next}</button> : <span />}
          </div>
        )}
      </div>
    </GuideCtx.Provider>
  );
}
