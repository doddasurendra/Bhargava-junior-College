import Link from 'next/link';
import { college, fullAddress, mapsLinkUrl, whatsappLink } from '@/content/college';
import { programs } from '@/content/programs';
import { getDict, getLang } from '@/lib/i18n-server';
import { LangSwitch, MobileMenu, NavLink, ThemeToggle } from './HeaderControls';
import { Crest } from './ui';

function navItems(t: ReturnType<typeof getDict>) {
  return [
    { href: '/results', label: t.nav.results },
    { href: '/programs', label: t.nav.programs },
    { href: '/fees', label: t.nav.fees },
    { href: '/scholarship', label: t.nav.scholarship },
    { href: '/hostel', label: t.nav.hostel },
    { href: '/visit', label: t.nav.visit },
    { href: '/about', label: t.nav.about },
    { href: '/contact', label: t.nav.contact },
  ];
}

export function Header() {
  const lang = getLang();
  const t = getDict();
  const items = navItems(t);
  return (
    <>
      <div className="bg-navy-950 text-xs text-white/80">
        <div className="container-x flex items-center justify-between gap-3 py-2">
          <p className="truncate">
            <span className="font-semibold text-gold-300">{t.admissionsOpen}</span>
            <span className="hidden md:inline"> · {college.hoursShort}</span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {college.phones.map((p, i) => (
              <a key={p.tel} href={`tel:${p.tel}`} className={`font-mono hover:text-white ${i > 0 ? 'hidden sm:inline' : ''}`}>
                {p.display}
              </a>
            ))}
            <LangSwitch current={lang} label={t.language} />
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="container-x relative flex h-16 items-center justify-between gap-4 sm:h-[72px]">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${college.name} — home`}>
            <Crest size={44} className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[17px] text-heading sm:text-lg">{college.name}</span>
              <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-muted">Saroornagar · Hyderabad</span>
            </span>
          </Link>
          <nav aria-label="Main" className="hidden items-center xl:flex">
            {items.map((i) => (
              <NavLink key={i.href} href={i.href}>
                {i.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/track" className="btn-outline hidden lg:inline-flex xl:hidden 2xl:inline-flex">
              {t.track}
            </Link>
            <Link href="/contact#enquire" className="btn-primary hidden sm:inline-flex">
              {t.enquire}
            </Link>
            <MobileMenu items={items} track={t.track} enquire={t.enquire} menuLabel={t.menu} />
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="bg-navy-950 text-white/75">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-3">
            <Crest size={56} />
            <div>
              <p className="font-display text-xl text-white">{college.name}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-gold-300">{college.motto}</p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6">
            IIT-JEE and NEET UG with the TS Intermediate Board, on a single campus in Saroornagar. Run by {college.society}.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">Programs</p>
          <ul className="mt-3 space-y-2 text-sm">
            {programs.map((p) => (
              <li key={p.slug}>
                <Link href={`/programs/${p.slug}`} className="hover:text-white">
                  {p.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/course-finder" className="hover:text-white">
                Course finder
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">Admissions</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ['/admissions', 'Admission process'],
              ['/fees', 'Fees & calculator'],
              ['/scholarship', 'BSAT scholarship test'],
              ['/visit', 'Book a campus visit'],
              ['/track', 'Track your admission'],
              ['/hostel', 'Hostel & campus life'],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Visit us</p>
          <address className="mt-3 not-italic leading-6">
            <a href={mapsLinkUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              {fullAddress}
            </a>
          </address>
          <ul className="mt-3 space-y-1">
            {college.phones.map((p) => (
              <li key={p.tel}>
                <a href={`tel:${p.tel}`} className="font-mono hover:text-white">
                  {p.display}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${college.email}`} className="hover:text-white">
                {college.email}
              </a>
            </li>
          </ul>
          <ul className="mt-3 space-y-0.5 text-xs text-white/60">
            {college.hours.map((h) => (
              <li key={h.days}>
                {h.days}: {h.time}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {college.name} · {college.society}
          </p>
          <p>We never promise ranks or seats.</p>
        </div>
      </div>
    </footer>
  );
}

export function MobileBar() {
  const t = getDict();
  const items = [
    { href: '/visit', label: t.bar.visit, icon: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z' },
    { href: '/fees', label: t.bar.fees, icon: 'M7 5h10M7 9h10M9 5c3 0 5 1.5 5 4s-2 4-5 4H7l7 6' },
    { href: `tel:${college.phones[0].tel}`, label: t.bar.call, icon: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2' },
    { href: whatsappLink(), label: t.bar.whatsapp, icon: 'M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3L3 21Z' },
    { href: '/contact#enquire', label: t.bar.enquire, icon: 'M4 6h16v10H8l-4 4V6Z' },
  ];
  return (
    <nav aria-label="Quick actions" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((i, idx) => {
          const external = i.href.startsWith('http') || i.href.startsWith('tel:');
          const cls = `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${idx === 4 ? 'text-maroon dark:text-gold' : 'text-ink/80'}`;
          const icon = (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={i.icon} />
            </svg>
          );
          return (
            <li key={i.label}>
              {external ? (
                <a href={i.href} className={cls} {...(i.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {icon}
                  {i.label}
                </a>
              ) : (
                <Link href={i.href} className={cls}>
                  {icon}
                  {i.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function WhatsAppButton() {
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with admissions on WhatsApp"
      className="fixed bottom-[9rem] right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 md:bottom-24 md:right-6"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
        <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.6a10.6 10.6 0 0 1-5.4-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.6 10.6 0 1 1 16 26.6Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7a.6.6 0 0 0 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8 1 3.9.8a3.3 3.3 0 0 0 2.1-1.5 2.7 2.7 0 0 0 .2-1.5c-.1-.2-.3-.3-.6-.4Z" />
      </svg>
    </a>
  );
}
