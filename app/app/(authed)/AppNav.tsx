'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { college } from '@/content/college';

const ICON: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z',
  fees: 'M7 5h10M7 9h10M9 5c3 0 5 1.5 5 4s-2 4-5 4H7l7 6',
  hostel: 'M3 21V9l9-6 9 6v12M9 21v-6h6v6',
  call: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
};

export function AppNav({ enrolled }: { enrolled: boolean }) {
  const path = usePathname();
  const items = [
    { href: '/app', label: 'Home', icon: 'home' },
    ...(enrolled ? [{ href: '/app/fees', label: 'Fees', icon: 'fees' }, { href: '/app/hostel', label: 'Hostel', icon: 'hostel' }] : []),
  ];
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
        <li className="flex-1">
          <a href={`tel:${college.phones[0].tel}`} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink/70">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICON.call} />
            </svg>
            Call college
          </a>
        </li>
      </ul>
    </nav>
  );
}
