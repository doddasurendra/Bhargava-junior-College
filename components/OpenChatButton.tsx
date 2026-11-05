'use client';
import type { ReactNode } from 'react';

/** Opens the website chat assistant (ChatWidget listens for this event). */
export function OpenChatButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event('bjc:open-chat'))} className={className}>
      {children}
    </button>
  );
}
