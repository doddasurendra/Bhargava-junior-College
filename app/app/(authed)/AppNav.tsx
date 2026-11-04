'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICON: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z',
  fees: 'M7 5h10M7 9h10M9 5c3 0 5 1.5 5 4s-2 4-5 4H7l7 6',
  study: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h12',
  test: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  chat: 'M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.3A8 8 0 1 1 21 12Z',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
};

type Kind = 'parent' | 'student' | 'applicant' | 'alumni' | null;

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  student: [{ href: '/app', label: 'Home', icon: 'home' }, { href: '/app/study', label: 'Study', icon: 'study' }, { href: '/app/tests', label: 'Tests', icon: 'test' }, { href: '/app/doubts', label: 'Doubts', icon: 'chat' }, { href: '/app/more', label: 'More', icon: 'more' }],
  parent: [{ href: '/app', label: 'Home', icon: 'home' }, { href: '/app/results', label: 'Progress', icon: 'chart' }, { href: '/app/fees', label: 'Fees', icon: 'fees' }, { href: '/app/messages', label: 'Teacher', icon: 'chat' }, { href: '/app/more', label: 'More', icon: 'more' }],
  applicant: [{ href: '/app', label: 'Status', icon: 'home' }, { href: '/app/apply', label: 'Apply', icon: 'doc' }, { href: '/app/documents', label: 'Documents', icon: 'study' }, { href: '/app/more', label: 'More', icon: 'more' }],
  alumni: [{ href: '/app', label: 'Home', icon: 'home' }, { href: '/app/alumni', label: 'Alumni', icon: 'star' }, { href: '/app/more', label: 'More', icon: 'more' }],
};

/** Bottom tabs for the active profile (§9A: each login gets its own home and menu). */
export function AppNav({ kind }: { kind: Kind }) {
  const path = usePathname();
  const items = NAV[kind ?? 'applicant'];
  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 backdrop-blur print:hidden">
      <ul className="flex">
        {items.map((i) => {
          const active = i.href === '/app' ? path === '/app' : path.startsWith(i.href);
          return (
            <li key={i.href} className="flex-1">
              <Link href={i.href} aria-current={active ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-maroon dark:text-gold' : 'text-ink/70'}`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={ICON[i.icon]} />
                </svg>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
