/**
 * The assistant's knowledge base, rendered from the same content the website shows (the CMS), so the
 * assistant can only state what the site states. The knowledge base is small (a few thousand tokens), so it
 * goes into the system prompt whole and is prompt-cached instead of needing a vector store; once the CMS
 * adds blog posts, resources and long FAQs, switch to retrieval over those.
 *
 * Deterministic output: no dates, no random ordering — any byte change invalidates the prompt cache.
 */
import { college, fullAddress } from '@/content/college';
import { programIncludes, programs } from '@/content/programs';
import type { Content } from '../cms/blocks';
import { formatINR } from '../fees';

export function buildKnowledge(c: Content): string {
  const { bsat, faculty, faqs, fees, hostel, results, visitSlots } = c;
  const admissionDocuments = c.documentChecklist.default.map((d) => d.label);
  const testimonials = c.testimonials.items;
  const sample = (s: boolean) => (s ? ' [SAMPLE DATA — the college has not yet confirmed this; say "currently listed" and suggest confirming with a counsellor]' : '');
  const lines: string[] = [];
  lines.push(`# ${college.name}`);
  lines.push(`Run by ${college.society}. Motto: ${college.motto}. Single campus in ${college.address.locality}, ${college.address.city}.`);
  lines.push(`Address: ${fullAddress}. Phones: ${college.phones.map((p) => p.display).join(', ')}. Email: ${college.email}.`);
  lines.push(`Office hours: ${college.hours.map((h) => `${h.days} ${h.time}`).join('; ')}.`);
  lines.push(`Leadership: ${college.leader.name}, ${college.leader.credentials}. Average faculty experience ${college.facultyAvgExperience}.`);
  lines.push(`Batches have at most ${college.maxBatchSize} students. One mentor for every ${college.mentorRatio} students, with a weekly one-to-one; monthly stress check-in and an on-campus counsellor.`);
  lines.push(`Parents get a weekly WhatsApp report every Sunday (attendance, test trend, mentor's note). Parents can book PTMs and message the class teacher in the app.`);

  lines.push('\n## Programs');
  for (const p of programs) {
    lines.push(`- ${p.name} (slug ${p.slug}): ${p.goal}, ${p.duration}. Prepares for ${p.targets.join(', ')}. Subjects: ${p.subjects.join(', ')}. ${p.summary} Eligibility: ${p.eligibility}${sample(true)} Timings: ${p.batchTimings}${sample(true)}`);
  }
  lines.push(`Every program includes: ${programIncludes.join(', ')}.`);

  lines.push(`\n## Fees ${fees.academicYear} (per year)${sample(fees.sample)}`);
  lines.push(`- 2-year JEE/NEET: tuition ${formatINR(fees.twoYear.tuition)}, study material & tests ${formatINR(fees.twoYear.material)}, admission fee ${formatINR(fees.twoYear.admission)} (one time).`);
  lines.push(`- Long Term: tuition ${formatINR(fees.longTerm.tuition)}, study material & tests ${formatINR(fees.longTerm.material)}, admission fee ${formatINR(fees.longTerm.admission)} (one time).`);
  lines.push(`- Hostel non-AC incl. food ${formatINR(fees.hostelNonAc)}; hostel AC incl. food ${formatINR(fees.hostelAc)}; transport for day scholars ${formatINR(fees.transport)}.`);
  lines.push(`- Pay in ${fees.instalmentOptions.join(', ')} instalments. Modes: ${fees.paymentModes.join(', ')}. Use the calculate_fee tool for exact totals.`);

  lines.push(`\n## BSAT scholarship test${sample(bsat.sample)}`);
  lines.push(`${bsat.durationMin} minutes; sections ${bsat.sections.join(', ')}; for ${bsat.eligibility}; campus or online; results within ${bsat.resultsWithin}.`);
  lines.push(`Tuition scholarship: ${bsat.slabs.map((s) => `${s.label} → ${s.pct}%`).join('; ')}. Extra ${bsat.gpaBonus}% for 10 GPA in SSC, total capped at ${bsat.cap}%.`);
  lines.push(`Test sessions (id, date, mode): ${bsat.sessions.map((s) => `${s.id} = ${s.date} ${s.mode}`).join('; ')}.`);

  lines.push(`\n## Hostel${sample(hostel.sample)}`);
  lines.push(`${hostel.blocks}. Rooms: ${hostel.rooms.join('; ')}. Safety: ${hostel.safety.join('; ')}. Health: ${hostel.health.join('; ')}. Amenities: ${hostel.amenities.join('; ')}. Food: ${hostel.food}`);
  lines.push(`Daily schedule: ${hostel.schedule.map((s) => `${s.time} ${s.activity}`).join(', ')}.`);

  lines.push(`\n## Campus visits`);
  lines.push(`Monday to Saturday, booked from tomorrow up to ${visitSlots.maxDaysAhead} days ahead. Slots: ${visitSlots.slots.map((s) => `${s.slot} (${s.label}${s.saturday ? '' : ', not on Saturdays'})`).join(', ')}. WhatsApp confirmation plus reminders 1 day and 2 hours before.`);

  lines.push(`\n## Admission process and documents`);
  lines.push(`Enquiry → campus visit → counselling → application → document verification → fee payment and receipt → College ID. Parents can track every step at /track with a one-time code.`);
  lines.push(`Documents: ${admissionDocuments.join('; ')}.`);

  lines.push(`\n## Results 2026${sample(results.sample)}`);
  lines.push(results.items.map((r) => `${r.name}: ${r.exam} ${r.score}`).join('; ') + '.');
  lines.push(`Totals: ${results.aggregates.map((a) => `${a.value} ${a.label}`).join('; ')}.`);

  lines.push(`\n## Faculty${sample(faculty.sample)}`);
  lines.push(faculty.items.map((f) => `${f.name} (${f.subject}, ${f.years} years)`).join('; ') + '.');
  

  if (testimonials.length) lines.push(`Parent testimonials from: ${testimonials.map((t) => (t.role ? `${t.name} (${t.role})` : t.name)).join('; ')}.`);

  lines.push(`\n## FAQs${sample(faqs.sample)}`);
  for (const f of faqs.items) lines.push(`Q: ${f.q} A: ${f.a}`);

  // Knowledge base: only articles marked public reach the website assistant (staff-only ones never do).
  const kb = c.knowledgeBase.items.filter((a) => a.audience === 'public' && a.published);
  if (kb.length) {
    lines.push(`\n## Knowledge base${sample(c.knowledgeBase.sample)}`);
    for (const a of kb) lines.push(`### ${a.title}\n${a.body}`);
  }

  lines.push(`\n## Useful pages`);
  lines.push('/programs, /fees (calculator at /fees#calculator), /scholarship (BSAT registration), /hostel, /visit (book a visit), /track (admission status with one-time code), /admissions, /results, /contact.');
  return lines.join('\n');
}
