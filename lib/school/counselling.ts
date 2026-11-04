import 'server-only';
import { STAGES, type StageKey } from '../admission';
import { can, canSeeLead } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import type { Staff } from '../crm/types';
import { counselling } from '../records/collections';
import { SchoolError, store } from './common';

/**
 * §7.1 step 7: the counsellor records the program discussed, whether fees and scholarship were explained,
 * concerns raised and the decision status. The binding admission decision (with its mandatory loss reason or
 * follow-up date) is still recorded through the Decision form, so those rules live in one place.
 */
const stageIndex = (s: StageKey) => STAGES.findIndex((x) => x.key === s);
const advanceStage = (current: StageKey, to: StageKey): StageKey => (stageIndex(to) > stageIndex(current) ? to : current);

export async function recordCounselling(user: Staff, input: { leadId: string; programDiscussed: string; feesExplained: boolean; scholarshipExplained: boolean; concerns: string | null; decision: 'confirmed' | 'pending' | 'lost'; notes: string | null }) {
  if (!can(user, 'counselling.record')) throw new SchoolError('You do not have permission to do this.');
  const repo = getCrmRepo();
  const lead = await repo.getLead(input.leadId);
  if (!lead || !canSeeLead(user, lead)) throw new SchoolError('Lead not found.');
  const rec = await counselling.put(store(), { ...input, counsellorId: user.id });
  const stage = advanceStage(lead.stage, 'counselling');
  const keep = ['decision_pending', 'confirmed', 'lost', 'admitted', 'invalid'].includes(lead.status);
  await repo.updateLead(lead.id, keep ? { stage } : { stage, status: 'counselled' }, [
    { action: 'counselled', actorId: user.id, field: 'counselling', newValue: `${input.programDiscussed}; fees ${input.feesExplained ? 'explained' : 'not explained'}; scholarship ${input.scholarshipExplained ? 'explained' : 'not explained'}; leaning ${input.decision}`, reason: input.concerns },
  ]);
  return rec;
}

export async function counsellingFor(leadId: string) {
  return (await counselling.list(store(), { k1: leadId })).map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data }));
}
