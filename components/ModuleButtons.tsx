import Link from 'next/link';
import { MODULE_BUTTONS, type ModuleButton } from '@/content/platform';

/** Big, clear buttons to each part of the platform (home "Explore" section and the Why Bhargava page). */
export function ModuleButtons({ items = MODULE_BUTTONS, compact = false }: { items?: ModuleButton[]; compact?: boolean }) {
  return (
    <ul className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      {items.map((m) => (
        <li key={m.href}>
          <Link href={m.href} className="card group flex h-full items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md focus-visible:border-gold">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-100 text-xl dark:bg-gold/15">{m.icon}</span>
            <span className="min-w-0">
              <span className="block font-semibold text-heading group-hover:text-maroon dark:group-hover:text-gold">{m.title}</span>
              {!compact && <span className="mt-0.5 block text-sm leading-5 text-muted">{m.body}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
