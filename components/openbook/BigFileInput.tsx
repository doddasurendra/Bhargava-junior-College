'use client';
import { useState } from 'react';

/**
 * File input that sends small files with the form, and uploads files over 4 MB straight to private storage
 * (signed URL) with a progress bar, then submits only the storage key.
 */
export function BigFileInput({ name, accept, label, required = false, maxMb = 50 }: { name: string; accept: string; label: string; required?: boolean; maxMb?: number }) {
  const [key, setKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setKey(''); setErr(null); setPct(null);
    if (!f) return;
    if (f.size > maxMb * 1024 * 1024) { setErr(`Files can be up to ${maxMb} MB.`); e.target.value = ''; return; }
    if (f.size <= 4 * 1024 * 1024) return; // small: goes with the form
    const sign = await fetch('/api/openbook/upload/sign', { method: 'POST' }).then((r) => r.json()).catch(() => null);
    if (!sign?.direct) return; // local: goes with the form
    const input = e.target;
    await new Promise<void>((resolve) => {
      const x = new XMLHttpRequest();
      x.open('PUT', sign.url);
      x.setRequestHeader('Content-Type', f.type || 'application/octet-stream');
      x.upload.onprogress = (p) => p.lengthComputable && setPct(Math.round((p.loaded / p.total) * 100));
      x.onload = () => { if (x.status < 300) { setKey(sign.key); setFileName(f.name); input.value = ''; } else setErr(`Upload failed (${x.status}).`); resolve(); };
      x.onerror = () => { setErr('Upload failed. Check your connection.'); resolve(); };
      x.send(f);
    });
  };
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <input type="file" name={key ? undefined : name} accept={accept} required={required && !key} onChange={onChange} className="block w-full text-sm" />
      {key && <><input type="hidden" name={`${name}__key`} value={key} /><input type="hidden" name={`${name}__name`} value={fileName} /></>}
      {pct !== null && <span className="mt-1 block text-xs text-muted">{key ? `Uploaded ${fileName} (100%)` : `Uploading… ${pct}%`}</span>}
      {err && <span role="alert" className="mt-1 block text-xs text-red-700">{err}</span>}
    </label>
  );
}
