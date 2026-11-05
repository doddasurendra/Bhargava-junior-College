'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PLATFORM_LINKS } from '@/content/platform';

/** The platform at a glance: website, portals, AI assistant and admission tracking, on every public page. */
export function PlatformBar() {
  const path = usePathname();
  return (
    <nav aria-label="Platform" className="border-b border-white/10 bg-[#0b1230] text-[11px] text-white/70">
      <div className="container-x flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none]">
        <span className="mr-1 hidden shrink-0 font-semibold uppercase tracking-[0.14em] text-gold-300 sm:inline">Platform</span>
        {PLATFORM_LINKS.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-full px-2.5 py-1 transition hover:bg-white/10 hover:text-white ${active ? 'bg-white/10 text-white' : ''}`}>
              <span className="sm:hidden">{l.short}</span>
              <span className="hidden sm:inline">{l.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => window.dispatchEvent(new Event('bjc:open-chat'))} className="shrink-0 rounded-full px-2.5 py-1 font-semibold text-gold-300 transition hover:bg-white/10 hover:text-white">
          ✦ AI assistant
        </button>
      </div>
    </nav>
  );
}
