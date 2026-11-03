import { z } from 'zod';
import { collection } from './collection';

/** Every collection in the record store, with its schema and index keys. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-06-01');
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Use a month like 2027-01');
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

// ---------------------------------------------------------------- management / marketing

/** Ad spend per source and month — cost per lead and source ROI on the dashboard (§8). */
export const marketingSpend = collection({
  name: 'marketing_spend',
  schema: z.object({ source: text(40), month, amount: z.coerce.number().int().min(0).max(100_000_000), note: optText(200), enteredBy: z.string() }),
  k1: (d) => d.month,
  k2: (d) => d.source,
});

export { isoDate, month, text, optText };
