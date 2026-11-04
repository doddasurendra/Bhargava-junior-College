'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

export type HeroSlide = {
  eyebrow: string;
  title: string;
  highlight: string | null;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
};

/**
 * Rotating hero headline. All slides stay in the DOM, stacked in one grid cell, so the height never jumps and
 * search engines read every slide (only the first is the page's h1). Auto-advance pauses on hover, on keyboard
 * focus, when the tab is hidden, and is off entirely for people who prefer reduced motion.
 */
export function HeroCarousel({ slides, intervalSec }: { slides: HeroSlide[]; intervalSec: number }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = slides.length;
  const rootRef = useRef<HTMLDivElement>(null);

  const go = useCallback((i: number) => setActive(((i % count) + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setActive((a) => (a + 1) % count);
    }, Math.max(4, intervalSec) * 1000);
    return () => window.clearInterval(id);
  }, [count, paused, reducedMotion, intervalSec]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
  };

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setPaused(false); }}
      onKeyDown={onKeyDown}
    >
      <div className="grid">
        {slides.map((s, i) => {
          const on = i === active;
          const Heading = i === 0 ? 'h1' : 'h2';
          return (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!on}
              // inert keeps hidden slides' buttons out of the tab order. Set on the DOM node directly: React 18
              // doesn't recognise the attribute and would drop a boolean value.
              ref={(el) => { if (el) { if (on) el.removeAttribute('inert'); else el.setAttribute('inert', ''); } }}
              className={`[grid-area:1/1] transition-opacity duration-700 motion-reduce:transition-none ${on ? 'opacity-100' : 'pointer-events-none invisible opacity-0'}`}
            >
              <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/5 px-3 py-1 text-xs font-semibold text-gold-300">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {s.eyebrow}
              </p>
              <Heading className="mt-5 font-display text-[2.6rem] leading-[1.06] sm:text-5xl lg:text-[4rem]">
                {s.title}
                {s.highlight && (
                  <>
                    <br />
                    <span className="text-gold-300">{s.highlight}</span>
                  </>
                )}
              </Heading>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg">{s.body}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <HeroLink href={s.primaryHref} className="btn-primary px-6 py-3">{s.primaryLabel}</HeroLink>
                {s.secondaryLabel && s.secondaryHref && (
                  <HeroLink href={s.secondaryHref} className="btn-gold px-6 py-3">{s.secondaryLabel}</HeroLink>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={() => go(active - 1)} aria-label="Previous slide" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 text-white/80 transition hover:border-gold hover:text-gold-300">
            <span aria-hidden>‹</span>
          </button>
          <div className="flex items-center gap-2" role="group" aria-label="Choose a slide">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}: ${s.title}`}
                aria-current={i === active ? 'true' : undefined}
                className={`h-2 rounded-full transition-all ${i === active ? 'w-6 bg-gold' : 'w-2 bg-white/30 hover:bg-white/60'}`}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(active + 1)} aria-label="Next slide" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 text-white/80 transition hover:border-gold hover:text-gold-300">
            <span aria-hidden>›</span>
          </button>
        </div>
      )}
    </div>
  );
}

function HeroLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith('https://')) {
    return <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}
