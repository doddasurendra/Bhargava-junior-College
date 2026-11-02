'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { previewImportAction, runImportAction, type ImportResult } from '@/app/crm/actions';
import { programs, type ProgramSlug } from '@/content/programs';
import { parseCsv, toCsv } from '@/lib/crm/csv';
import { guessMapping, IMPORT_FIELDS, IMPORT_SOURCES, MAX_IMPORT_ROWS, type ImportSource, type Mapping } from '@/lib/crm/importer';
import type { ImportPreview } from '@/lib/crm/service';

const MAX_BYTES = 2 * 1024 * 1024;
const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

const TEMPLATE = [
  ['Student name', 'Parent name', 'Parent phone', 'Student phone', 'School', 'Class', 'Board', 'Area', 'Interested program', 'Notes'],
  ['K. Ravi Teja', 'K. Srinivas', '9876543210', '', 'ZPHS Saroornagar', 'Class 10', 'SSC', 'Dilsukhnagar', 'MPC', ''],
];

export function ImportWizard() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [source, setSource] = useState<ImportSource | ''>('');
  const [school, setSchool] = useState('');
  const [program, setProgram] = useState<ProgramSlug | ''>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useMemo(
    () => (file ? { fileName: file.name, text: file.text, mapping, source, defaults: { school: school.trim() || null, program: program || null } } : null),
    [file, mapping, source, school, program],
  );

  const invalidate = () => {
    setPreview(null);
    setError(null);
  };

  async function onFile(f: File | undefined) {
    invalidate();
    setResult(null);
    setFile(null);
    if (!f) return;
    if (/\.(xlsx?|ods)$/i.test(f.name)) return setError('This is a spreadsheet file. In Excel choose File → Save As → “CSV UTF-8 (Comma delimited)”, then upload the .csv.');
    if (f.size > MAX_BYTES) return setError('The file is larger than 2 MB. Split it into smaller files.');
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) return setError('The file has no data rows. The first row must be the column headers.');
    if (parsed.rows.length > MAX_IMPORT_ROWS) return setError(`The file has ${parsed.rows.length} rows; the limit is ${MAX_IMPORT_ROWS} per import.`);
    setFile({ name: f.name, text });
    setHeaders(parsed.headers);
    setSampleRows(parsed.rows.slice(0, 3));
    setRowCount(parsed.rows.length);
    setMapping(guessMapping(parsed.headers));
  }

  async function runPreview() {
    if (!request) return;
    setBusy('preview');
    setError(null);
    const r = await previewImportAction(request);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setPreview(r.preview);
  }

  async function runImport() {
    if (!request) return;
    setBusy('import');
    setError(null);
    const r = await runImportAction(request);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setResult(r);
    setPreview(null);
  }

  function downloadRejected() {
    if (!preview) return;
    download(`rejected-${file?.name ?? 'rows'}`, toCsv([['Line', 'Reason', ...headers], ...preview.rejected.map((r) => [String(r.line), r.reason, ...r.raw])]));
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-50">
        <p className="font-display text-2xl">Import complete</p>
        <p className="mt-2 text-sm">
          <strong>{result.created}</strong> new leads created, <strong>{result.merged}</strong> merged into existing leads, <strong>{result.duplicatesInFile}</strong> duplicate rows in the file combined, <strong>{result.invalid}</strong> rows rejected.
        </p>
        <p className="mt-1 text-sm">Next: the admission manager qualifies the new leads (Hot / Warm / Cold / Invalid) and allocates them to telecallers.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/crm/leads?source=${source}&category=none`} className="btn-primary">Qualify imported leads</Link>
          <button type="button" className="btn-outline" onClick={() => { setResult(null); setFile(null); setHeaders([]); setSource(''); }}>
            Import another file
          </button>
        </div>
      </div>
    );
  }

  const mappedCount = Object.values(mapping).filter((v) => v !== null && v !== undefined).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-heading">1 · Choose a CSV file</h2>
            <p className="mt-1 text-xs text-muted">First row = column headers. Up to {MAX_IMPORT_ROWS} rows and 2 MB. From Excel: File → Save As → CSV UTF-8.</p>
          </div>
          <button type="button" className="text-xs font-semibold text-maroon underline dark:text-gold" onClick={() => download('lead-import-template.csv', toCsv(TEMPLATE))}>
            Download template
          </button>
        </div>
        <input type="file" accept=".csv,text/csv,.txt" className="mt-3 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" onChange={(e) => onFile(e.target.files?.[0])} />
        {file && (
          <p className="mt-2 text-sm text-muted">
            <span className="font-semibold text-ink">{file.name}</span> · {rowCount} rows · {headers.length} columns
          </p>
        )}
      </section>

      {file && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-heading">2 · Match the columns</h2>
          <p className="mt-1 text-xs text-muted">We guessed {mappedCount} from the headers. A phone column and a name column are required.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="table-base min-w-[640px] text-[13px]">
              <thead>
                <tr>
                  <th>Lead field</th>
                  <th>Column in your file</th>
                  <th>First rows</th>
                </tr>
              </thead>
              <tbody>
                {IMPORT_FIELDS.map((f) => {
                  const col = mapping[f.key];
                  return (
                    <tr key={f.key}>
                      <td className="font-medium">
                        {f.label}
                        {(f.key === 'phone' || f.key === 'studentName') && <span className="text-maroon dark:text-gold"> *</span>}
                      </td>
                      <td>
                        <select
                          className="input w-56 py-1.5 text-sm"
                          value={col ?? ''}
                          onChange={(e) => {
                            invalidate();
                            setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? null : Number(e.target.value) }));
                          }}
                        >
                          <option value="">— not in file —</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="max-w-[260px] truncate text-muted">{col !== null && col !== undefined ? sampleRows.map((r) => r[col]).filter(Boolean).join(' · ') : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">* Parent phone or student phone, and student name or parent name. If the parent phone is missing or invalid, the student phone is used.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <label>
              <span className={lbl}>Source *</span>
              <select className="input py-2" value={source} onChange={(e) => { invalidate(); setSource(e.target.value as ImportSource); }}>
                <option value="">Choose…</option>
                {IMPORT_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={lbl}>School (if blank in file)</span>
              <input className="input py-2" value={school} onChange={(e) => { invalidate(); setSchool(e.target.value); }} maxLength={120} placeholder="e.g. ZPHS Saroornagar" />
            </label>
            <label>
              <span className={lbl}>Program (if blank in file)</span>
              <select className="input py-2" value={program} onChange={(e) => { invalidate(); setProgram(e.target.value as ProgramSlug | ''); }}>
                <option value="">Leave blank</option>
                {programs.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="btn-primary mt-5" disabled={busy !== null} onClick={runPreview}>
            {busy === 'preview' ? 'Checking…' : 'Check file'}
          </button>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:bg-red-400/10 dark:text-red-200">
          {error}
        </p>
      )}

      {preview && (
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-heading">3 · Review and import</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Rows in file', preview.totalRows, ''],
              ['New leads', preview.newLeads, 'text-emerald-700 dark:text-emerald-300'],
              ['Merge into existing', preview.mergeExisting, 'text-navy dark:text-gold'],
              ['Duplicates in file', preview.duplicatesInFile, 'text-muted'],
              ['Rejected', preview.rejected.length, preview.rejected.length ? 'text-red-600 dark:text-red-300' : 'text-muted'],
            ].map(([l, v, cls]) => (
              <div key={l as string} className="rounded-xl bg-bg p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{l}</p>
                <p className={`mt-1 font-mono text-2xl font-semibold ${cls}`}>{v}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className={lbl}>By school</p>
              <table className="table-base text-[13px]">
                <thead>
                  <tr>
                    <th>School</th>
                    <th className="text-right">Valid rows</th>
                    <th className="text-right">Already known</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.bySchool.map((s) => (
                    <tr key={s.school}>
                      <td>{s.school}</td>
                      <td className="text-right font-mono">{s.rows}</td>
                      <td className="text-right font-mono text-muted">{s.existing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className={lbl}>Rejected rows</p>
                {preview.rejected.length > 0 && (
                  <button type="button" onClick={downloadRejected} className="text-xs font-semibold text-maroon underline dark:text-gold">
                    Download all ({preview.rejected.length}) to fix
                  </button>
                )}
              </div>
              {preview.rejected.length === 0 ? (
                <p className="text-sm text-muted">None, every row is usable.</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto text-[13px]">
                  {preview.rejected.slice(0, 50).map((r) => (
                    <li key={r.line} className="flex gap-3">
                      <span className="w-14 shrink-0 font-mono text-muted">line {r.line}</span>
                      <span>{r.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <p className={lbl}>First rows as they will be saved</p>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[760px] text-[13px]">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Student</th>
                    <th>Parent</th>
                    <th>Phone</th>
                    <th>School</th>
                    <th>Class</th>
                    <th>Program</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r) => (
                    <tr key={r.line}>
                      <td className="font-mono text-muted">{r.line}</td>
                      <td>{r.studentName ?? '—'}</td>
                      <td>{r.parentName ?? '—'}</td>
                      <td className="font-mono">
                        {r.phone}
                        {r.studentPhone && <span className="block text-muted">{r.studentPhone}</span>}
                      </td>
                      <td>{r.school ?? '—'}</td>
                      <td>{r.classLevel ?? '—'}</td>
                      <td>{r.program ? programs.find((p) => p.slug === r.program)?.short : '—'}</td>
                      <td>{r.existing && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-semibold text-navy dark:bg-white/10 dark:text-white">merge</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button type="button" className="btn-primary" disabled={busy !== null || preview.valid === 0} onClick={runImport}>
              {busy === 'import' ? 'Importing…' : `Import ${preview.newLeads} new · merge ${preview.mergeExisting}`}
            </button>
            <p className="text-xs text-muted">Merges only fill empty fields on existing leads; nothing already recorded is overwritten. Imported leads are not marked as having given web consent.</p>
          </div>
        </section>
      )}
    </div>
  );
}
