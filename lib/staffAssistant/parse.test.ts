import { describe, expect, it } from 'vitest';
import { parseQuery } from './parse';

describe('staff assistant question parser', () => {
  it('maps the brief’s example questions to safe lookups', () => {
    expect(parseQuery('BJC-2027-JEE-0001')).toEqual({ kind: 'lookup', q: 'BJC-2027-JEE-0001' });
    expect(parseQuery('show bjc-2027-neet-0012 please')).toEqual({ kind: 'lookup', q: 'BJC-2027-NEET-0012' });
    expect(parseQuery('students below 75% attendance in JEE batch A')).toEqual({ kind: 'attendance', below: 75, batch: 'JEE A' });
    expect(parseQuery('attendance under 60')).toMatchObject({ kind: 'attendance', below: 60, batch: null });
    expect(parseQuery('fee defaulters this month')).toEqual({ kind: 'dues' });
    expect(parseQuery("compare Rahul's last 3 tests")).toEqual({ kind: 'compare', who: 'Rahul', count: 3 });
    expect(parseQuery('compare Asha Reddy’s last 5 tests')).toEqual({ kind: 'compare', who: 'Asha Reddy', count: 5 });
    expect(parseQuery('list all Hot leads not called today')).toEqual({ kind: 'leads', category: 'hot', notCalledToday: true });
    expect(parseQuery('warm leads')).toEqual({ kind: 'leads', category: 'warm', notCalledToday: false });
    expect(parseQuery('Rahul Kumar')).toEqual({ kind: 'lookup', q: 'Rahul Kumar' });
  });
});
