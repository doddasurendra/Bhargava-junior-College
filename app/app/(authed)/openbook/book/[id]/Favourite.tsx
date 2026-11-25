'use client';
import { useState, useTransition } from 'react';
import { readerFavourite } from '../../actions';

export function FavouriteButton({ bookId, initial }: { bookId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { const r = await readerFavourite(bookId); if (r.ok) setOn(!!r.data); })} className="btn-outline px-3 py-1 text-xs">{on ? '★ Favourite' : '☆ Add to favourites'}</button>;
}
