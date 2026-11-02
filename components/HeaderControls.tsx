'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LANG_COOKIE, LANGS, type Lang } from '@/lib/i18n';

export function LangSwitch({ current, label }: { current: Lang; label: string }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={current}
        onChange={(e) => {
          document.cookie = `${LANG_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="cursor-pointer rounded-md border border-white/20 bg-transparent px-1.5 py-0.5 text-xs text-white [&>option]:text-ink"
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

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('bjc_theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };
  return (
    <button type="button" onClick={toggle} aria-label="Toggle dark mode" className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-bg hover:text-ink">
      <svg viewBox="0 0 24 24" className="h-5 w-5 dark:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 24 24" className="hidden h-5 w-5 dark:block" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function MobileMenu({ items, track, enquire, menuLabel }: { items: { href: string; label: string }[]; track: string; enquire: string; menuLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="xl:hidden" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink"
      >
        <span className="sr-only">{menuLabel}</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-nav" className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-lg animate-rise">
          <ul className="container-x grid gap-1 py-4">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className={`block rounded-lg px-3 py-2.5 font-medium ${pathname.startsWith(i.href) ? 'bg-bg text-maroon dark:text-gold' : 'text-ink hover:bg-bg'}`}>
                  {i.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/track" className="btn-outline">
                {track}
              </Link>
              <Link href="/contact#enquire" className="btn-primary">
                {enquire}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium transition ${active ? 'text-maroon dark:text-gold' : 'text-ink/80 hover:text-ink'}`}
    >
      {children}
    </Link>
  );
}
