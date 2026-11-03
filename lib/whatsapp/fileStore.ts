import { randomUUID } from 'node:crypto';
import { pushAudit, tx } from '../store/file';
import { STATUS_RANK } from './webhook';
import type { MessageStore } from './types';

export function createFileMessageStore(): MessageStore {
  return {
    leadForPhone: (phone) =>
      tx((db) => {
        // The family's primary lead (siblings share the parent phone and its consent).
        const l = db.leads.find((x) => !x.siblingOf && (x.phone === phone || x.studentPhone === phone));
        return l ? { id: l.id, consent: Boolean(l.consentAt) } : null;
      }, false),

    insertOutbound: (m) =>
      tx((db) => {
        if (m.dedupeKey && db.waMessages.some((x) => x.dedupeKey === m.dedupeKey)) return null;
        const now = new Date().toISOString();
        const row = { ...m, id: randomUUID(), createdAt: now, updatedAt: now };
        db.waMessages.push(row);
        return row;
      }),

    updateOutbound: (id, patch) =>
      tx((db) => {
        const m = db.waMessages.find((x) => x.id === id);
        if (m) Object.assign(m, patch, { updatedAt: new Date().toISOString() });
      }),

    applyStatus: (providerId, status, error) =>
      tx((db) => {
        const m = db.waMessages.find((x) => x.providerId === providerId);
        if (!m || m.status === 'failed' || STATUS_RANK[status] <= STATUS_RANK[m.status]) return;
        Object.assign(m, { status, error: error ?? m.error, updatedAt: new Date().toISOString() });
      }),

    insertInbound: (m) =>
      tx((db) => {
        if (db.waInbound.some((x) => x.providerId === m.providerId)) return false;
        db.waInbound.push({ ...m, id: randomUUID() });
        return true;
      }),

    isOptedOut: (phone) => tx((db) => db.waOptOuts.some((o) => o.phone === phone), false),

    setOptOut: (phone, optedOut, source) =>
      tx((db) => {
        db.waOptOuts = db.waOptOuts.filter((o) => o.phone !== phone);
        if (optedOut) db.waOptOuts.push({ phone, at: new Date().toISOString(), source });
        const l = db.leads.find((x) => !x.siblingOf && (x.phone === phone || x.studentPhone === phone));
        if (l) pushAudit(db, l.id, { actorId: null, action: optedOut ? 'whatsapp_opt_out' : 'whatsapp_opt_in', field: 'whatsapp', oldValue: null, newValue: source, reason: null });
      }),

    recordConsent: (leadId, actorId, note) =>
      tx((db) => {
        const l = db.leads.find((x) => x.id === leadId);
        if (!l) throw new Error('lead_not_found');
        l.consentAt = new Date().toISOString();
        pushAudit(db, leadId, { actorId, action: 'consent_recorded', field: 'consent', oldValue: 'false', newValue: 'true', reason: note });
      }),

    listForLead: (leadId, limit = 100) =>
      tx((db) => {
        const l = db.leads.find((x) => x.id === leadId);
        const phones = [l?.phone, l?.studentPhone].filter(Boolean);
        return {
          outbound: db.waMessages.filter((m) => m.leadId === leadId || phones.includes(m.to)).slice(-limit),
          inbound: db.waInbound.filter((m) => m.leadId === leadId || phones.includes(m.from)).slice(-limit),
        };
      }, false),
  };
}
