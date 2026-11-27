'use client';
import { useEffect } from 'react';
import { deserialise, translate, type CompiledDict } from '@/lib/crm-i18n/translate';

/**
 * Translates the staff CRM into Telugu or Hindi in the browser.
 * Text nodes and the placeholder / title / aria-label / alt attributes are matched against the shared dictionary
 * (English text is the key), including text that appears later: server action messages, validation errors,
 * popups and lists that load after the page. Only the visible text changes; form values, database values,
 * links and code are never touched. Mark an element `data-no-translate` to leave it in English.
 */
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'KBD', 'SAMP', 'NOSCRIPT']);

export function CrmTranslator({ lang }: { lang: 'en' | 'te' | 'hi' }) {
  useEffect(() => {
    const root = document.documentElement;
    if (lang === 'en') { root.removeAttribute('data-tr'); return; }
    let dict: CompiledDict | null = null;
    let observer: MutationObserver | null = null;
    const done = new WeakMap<Node, string>(); // node → the translated text we wrote (so we don't loop)
    const origAttr = new WeakMap<Element, Record<string, string>>();
    let cancelled = false;

    const skipEl = (el: Element | null): boolean => {
      for (let e = el; e; e = e.parentElement) {
        if (SKIP.has(e.tagName) || e.hasAttribute('data-no-translate') || (e as HTMLElement).isContentEditable) return true;
      }
      return false;
    };
    const tText = (n: Text) => {
      const v = n.nodeValue ?? '';
      if (!v.trim() || done.get(n) === v) return;
      if (skipEl(n.parentElement)) return;
      const out = translate(dict!, v);
      if (out === null) return;
      const lead = /^\s*/.exec(v)![0], trail = /\s*$/.exec(v)![0];
      const nv = lead + out + trail;
      done.set(n, nv);
      if (nv !== v) n.nodeValue = nv;
    };
    const tAttrs = (el: Element) => {
      if (skipEl(el)) return;
      const o = origAttr.get(el) ?? {};
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v) continue;
        if (o[a] !== undefined && v === translate(dict!, o[a])) continue;
        const out = translate(dict!, v);
        if (out !== null && out !== v) { o[a] = v; el.setAttribute(a, out); }
      }
      if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button') && el.value) {
        const out = translate(dict!, el.value);
        if (out !== null && out !== el.value) el.value = out;
      }
      origAttr.set(el, o);
    };
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { tText(node as Text); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (SKIP.has(el.tagName)) return;
      tAttrs(el);
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) tText(n as Text); else tAttrs(n as Element);
      }
    };

    // translate browser dialogs raised by the CRM (confirm before deleting, alerts)
    const { alert: a0, confirm: c0 } = window;
    window.alert = (m?: unknown) => a0.call(window, typeof m === 'string' ? translate(dict!, m) ?? m : m);
    window.confirm = (m?: string) => c0.call(window, typeof m === 'string' ? translate(dict!, m) ?? m : m);

    (async () => {
      try {
        let j = null as null | Parameters<typeof deserialise>[0];
        const key = `bjc_crm_i18n_${lang}_v1`;
        try { const c = sessionStorage.getItem(key); if (c) j = JSON.parse(c); } catch { /* ignore */ }
        if (!j) {
          const r = await fetch(`/api/crm-i18n/${lang}`);
          j = await r.json();
          try { sessionStorage.setItem(key, JSON.stringify(j)); } catch { /* quota */ }
        }
        if (cancelled || !j) return;
        dict = deserialise(j);
        // the college's own trilingual content (Knowledge Hub titles), only when signed in as staff
        try {
          const r = await fetch(`/api/crm-i18n/${lang}/content`, { credentials: 'same-origin' });
          if (r.ok) { const c = (await r.json()) as { exact: Record<string, string> }; for (const [k, v] of Object.entries(c.exact)) if (!dict.exact.has(k)) dict.exact.set(k, v); }
        } catch { /* optional */ }
        if (cancelled) return;
        walk(document.body);
        observer = new MutationObserver((muts) => {
          for (const m of muts) {
            if (m.type === 'characterData') tText(m.target as Text);
            else if (m.type === 'attributes') tAttrs(m.target as Element);
            else m.addedNodes.forEach(walk);
          }
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
      } catch {
        /* the page stays in English if the dictionary can't load */
      } finally {
        root.removeAttribute('data-tr');
      }
    })();
    return () => { cancelled = true; observer?.disconnect(); window.alert = a0; window.confirm = c0; };
  }, [lang]);
  return null;
}
