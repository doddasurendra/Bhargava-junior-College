import { createClient } from '@supabase/supabase-js';
import type { Content } from './blocks';

/**
 * Visit slots and BSAT sessions are also database rows in Supabase (bookings reference them and the booking
 * functions enforce capacity there). After a CMS save, mirror the block into those tables. Rows that were
 * removed in the CMS are deactivated, never deleted, so existing bookings keep their reference.
 */
export async function syncMasters(key: string, value: unknown) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (key === 'visitSlots') {
    const v = value as Content['visitSlots'];
    const { error } = await sb.from('visit_slots').upsert(v.slots.map((s) => ({ slot: s.slot, label: s.label, capacity: s.capacity, saturday: s.saturday, active: true })));
    if (error) throw new Error(`visit_slots sync: ${error.message}`);
    const keep = v.slots.map((s) => s.slot);
    const off = await sb.from('visit_slots').update({ active: false }).not('slot', 'in', `(${keep.map((s) => `"${s}"`).join(',')})`);
    if (off.error) throw new Error(`visit_slots sync: ${off.error.message}`);
  }

  if (key === 'bsat') {
    const v = value as Content['bsat'];
    const { error } = await sb.from('bsat_sessions').upsert(v.sessions.map((s) => ({ id: s.id, exam_date: s.date, mode: s.mode, active: true })));
    if (error) throw new Error(`bsat_sessions sync: ${error.message}`);
    const keep = v.sessions.map((s) => s.id);
    if (keep.length) {
      const off = await sb.from('bsat_sessions').update({ active: false }).not('id', 'in', `(${keep.map((s) => `"${s}"`).join(',')})`);
      if (off.error) throw new Error(`bsat_sessions sync: ${off.error.message}`);
    }
  }
}
