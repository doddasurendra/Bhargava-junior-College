import { describe, expect, it } from 'vitest';
import { detectDistress, safetyMessage, DEFAULT_HELPLINES } from './safety';
import { heuristicSuggestion, learningProfile, pickFor, similarity, similarPairs } from './openbookLogic';

describe('safety protocol: distress detection', () => {
  it('flags clear signs of distress in English, Hindi and Telugu', () => {
    for (const t of ['I want to kill myself', 'sometimes I think about suicide', 'I want to end my life', 'I don\'t want to live anymore', 'no reason to live', 'I keep hurting myself', 'मैं आत्महत्या के बारे में सोचता हूँ', 'mujhe marna chahta hoon', 'నాకు చచ్చిపోవాలని ఉంది', 'ఆత్మహత్య ఆలోచనలు'])
      expect(detectDistress(t), t).toBe(true);
  });
  it('does not flag ordinary exam stress', () => {
    for (const t of ['Physics test killed me today haha', 'I am stressed about the mock test', 'I could not sleep well, tired', 'The chapter on life processes is hard', 'I died laughing at the joke', null, ''])
      expect(detectDistress(t as string), String(t)).toBe(false);
  });
  it('the calm message names the counsellor and the Tele-MANAS helpline', () => {
    const m = safetyMessage({ name: 'Ms. Deepa', phone: '+91 90000 09990' }, DEFAULT_HELPLINES);
    expect(m).toContain('Ms. Deepa');
    expect(m).toContain('14416');
  });
});

describe('open-book helpers', () => {
  const long = 'When the car moves at constant speed the distance increases evenly with time because the speed does not change so the graph is a straight line through the origin';
  it('similarity flags copied answers but not different ones', () => {
    expect(similarity(long, long)).toBe(1);
    expect(similarity(long, 'Breathing gets faster after running because muscles need more oxygen and the heart pumps faster to carry it')).toBeLessThan(0.1);
    expect(similarPairs([{ studentId: 'a', answers: { q: long } }, { studentId: 'b', answers: { q: long } }, { studentId: 'c', answers: { q: 'Different words entirely about something unrelated to cars or graphs at all here' } }])).toHaveLength(1);
  });
  it('rule-based suggestion stays inside each rubric maximum', () => {
    const s = heuristicSuggestion(long, long, [{ criterion: 'Concept understanding', max: 4 }, { criterion: 'Explanation', max: 2 }]);
    expect(s['Concept understanding']).toBeLessThanOrEqual(4);
    expect(s['Concept understanding']).toBeGreaterThan(2);
    expect(s.Explanation).toBeLessThanOrEqual(2);
    expect(heuristicSuggestion('', long, [{ criterion: 'Concept understanding', max: 4 }])['Concept understanding']).toBe(0);
  });
  it('learning profile separates apply gaps from recall gaps', () => {
    expect(learningProfile(80, 60).key).toBe('apply_gap');
    expect(learningProfile(55, 80).key).toBe('recall_gap');
    expect(learningProfile(70, 72).key).toBe('balanced');
    expect(learningProfile(null, 70).key).toBe('not_enough_data');
  });
  it('randomised sets are stable per student and differ between students', () => {
    const pool = Array.from({ length: 10 }, (_, i) => `q${i}`);
    expect(pickFor(pool, 4, 'a1:s1')).toEqual(pickFor(pool, 4, 'a1:s1'));
    expect(pickFor(pool, 4, 'a1:s1')).toHaveLength(4);
    expect(pickFor(pool, 4, 'a1:s1').join()).not.toBe(pickFor(pool, 4, 'a1:s2').join());
  });
});
