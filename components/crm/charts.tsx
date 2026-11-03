/**
 * Server-rendered charts for the management dashboard (no chart library). Following the dataviz method:
 * one axis, thin marks, hairline recessive grid, 2px lines, 4px rounded bar ends, 2px gaps between stacked
 * segments, legend + selective direct labels, text in ink tokens (never series colours), native hover
 * tooltips on every mark, and a table view for every chart.
 */
import type { ReactNode } from 'react';
import { formatDate } from '@/lib/dates';

const fmt = (n: number) => n.toLocaleString('en-IN');

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const m = v / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pow;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function TableView({ summary = 'Show as table', children }: { summary?: string; children: ReactNode }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted underline">{summary}</summary>
      <div className="mt-2 max-h-64 overflow-auto">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------- line chart

export interface LineSeries {
  key: string;
  label: string;
  color: string;
}

export function TrendChart({ rows, series, height = 220 }: { rows: ({ date: string } & Record<string, number | string>)[]; series: LineSeries[]; height?: number }) {
  // Drawn at roughly the card's real width so 11px text stays 11px (no viewBox shrinking).
  const W = 480;
  const pad = { l: 28, r: 104, t: 10, b: 24 };
  const H = height;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0))));
  const x = (i: number) => pad.l + (rows.length <= 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const step = Math.max(1, Math.ceil(rows.length / 6));
  // End labels: nudge apart so they never overlap.
  const ends = series
    .map((s) => ({ s, v: Number(rows.at(-1)?.[s.key]) || 0 }))
    .sort((a, b) => b.v - a.v)
    .reduce<{ s: LineSeries; v: number; y: number }[]>((acc, e) => {
      const want = y(e.v);
      const prev = acc.at(-1);
      acc.push({ ...e, y: prev && want - prev.y < 14 ? prev.y + 14 : want });
      return acc;
    }, []);

  return (
    <figure>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`Daily ${series.map((s) => s.label).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {rows.map((r, i) =>
          i % step === 0 || i === rows.length - 1 ? (
            <text key={r.date} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>
              {formatDate(r.date, { day: 'numeric', month: 'short' })}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={rows.map((r, i) => `${x(i)},${y(Number(r[s.key]) || 0)}`).join(' ')} />
        ))}
        {series.map((s) => {
          const v = Number(rows.at(-1)?.[s.key]) || 0;
          return <circle key={s.key} cx={x(rows.length - 1)} cy={y(v)} r={4} fill={s.color} stroke="rgb(var(--surface))" strokeWidth={2} />;
        })}
        {ends.map((e) => (
          <text key={e.s.key} x={W - pad.r + 8} y={e.y + 3} className="fill-ink" style={{ fontSize: 11 }}>
            {e.s.label} {fmt(e.v)}
          </text>
        ))}
        {/* Hover layer: one column per day, wider than the marks, with the day's values. */}
        {rows.map((r, i) => (
          <rect key={`h${r.date}`} x={x(i) - iw / Math.max(1, rows.length - 1) / 2} y={pad.t} width={iw / Math.max(1, rows.length - 1)} height={ih} fill="transparent" className="hover:fill-[rgb(var(--ink)/0.05)]">
            <title>{`${formatDate(r.date)}\n${series.map((s) => `${s.label}: ${fmt(Number(r[s.key]) || 0)}`).join('\n')}`}</title>
          </rect>
        ))}
      </svg>
      <TableView>
        <table className="table-base text-xs">
          <thead>
            <tr>
              <th>Date</th>
              {series.map((s) => (
                <th key={s.key} className="text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{formatDate(r.date, { day: 'numeric', month: 'short' })}</td>
                {series.map((s) => (
                  <td key={s.key} className="text-right tabular-nums">
                    {fmt(Number(r[s.key]) || 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </figure>
  );
}

// ---------------------------------------------------------------- bars (single series, one colour)

export interface BarRow {
  label: string;
  value: number;
  /** extra text after the value, e.g. a conversion rate */
  note?: string | null;
  hint?: string;
}

export function BarList({ rows, color = 'var(--viz-1)', unit = '' }: { rows: BarRow[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3 text-sm" title={r.hint ? `${r.label}: ${fmt(r.value)}${unit} — ${r.hint}` : `${r.label}: ${fmt(r.value)}${unit}`}>
          <span className="truncate text-ink/85">{r.label}</span>
          <span className="h-3 rounded-r-[4px] bg-[var(--viz-grid)]">
            <span className="block h-3 rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 3 : 0, background: color }} />
          </span>
          <span className="w-24 text-right tabular-nums">
            <span className="font-semibold text-heading">
              {fmt(r.value)}
              {unit}
            </span>
            {r.note && <span className="ml-1 text-xs text-muted">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- 100% stacked mix

export interface MixSegment {
  key: string;
  label: string;
  color: string;
}

export function MixBars({ rows, segments }: { rows: ({ key: string; total: number } & Record<string, number | string>)[]; segments: MixSegment[] }) {
  return (
    <figure>
      <Legend items={segments.map((s) => ({ label: s.label, color: s.color }))} />
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(7rem,11rem)_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate text-ink/85">{String(r.key)}</span>
            <span className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]">
              {segments.map((s) => {
                const v = Number(r[s.key]) || 0;
                if (!v) return null;
                return <span key={s.key} className="h-3" style={{ width: `${(v / r.total) * 100}%`, background: s.color }} title={`${String(r.key)} · ${s.label}: ${v} of ${r.total} (${Math.round((v / r.total) * 100)}%)`} />;
              })}
            </span>
            <span className="text-right text-xs tabular-nums text-muted">{r.total}</span>
          </li>
        ))}
      </ul>
      <TableView>
        <table className="table-base text-xs">
          <thead>
            <tr>
              <th />
              {segments.map((s) => (
                <th key={s.key} className="text-right">
                  {s.label}
                </th>
              ))}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{String(r.key)}</td>
                {segments.map((s) => {
                  const v = Number(r[s.key]) || 0;
                  return (
                    <td key={s.key} className="text-right tabular-nums">
                      {v} <span className="text-muted">({Math.round((v / r.total) * 100)}%)</span>
                    </td>
                  );
                })}
                <td className="text-right tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </figure>
  );
}
