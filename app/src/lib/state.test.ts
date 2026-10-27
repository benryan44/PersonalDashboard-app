import { describe, expect, it } from 'vitest';
import { gymThisWeek, initialState, reducer, type State } from './state';

const MON = '2026-10-26', TUE = '2026-10-27', WED = '2026-10-28', THU = '2026-10-29';

const withTasks = (day: string): State => {
  let s = initialState(day);
  s = reducer(s, { type: 'addTask', title: 'Finish client check-ins', minutes: 630 });
  s = reducer(s, { type: 'addTask', title: 'Gym — legs', minutes: 1050 });
  s = reducer(s, { type: 'addTask', title: 'Call mum', minutes: 1200 });
  return s;
};

describe('day lifecycle', () => {
  it('carries unfinished tasks into the next day and drops done ones', () => {
    let s = withTasks(MON);
    s = reducer(s, { type: 'toggleTask', id: s.tasks[0].id });
    s = reducer(s, { type: 'commit' });
    s = reducer(s, { type: 'rollover', today: TUE });
    expect(s.day).toBe(TUE);
    expect(s.committed).toBe(false);
    expect(s.tasks.map(t => [t.title, t.tag])).toEqual([
      ['Gym — legs', 'Carried from Mon'],
      ['Call mum', 'Carried from Mon'],
    ]);
  });

  it('keeps the streak only for consecutive closed days', () => {
    let s = reducer(withTasks(MON), { type: 'finishDay' });
    expect(s.streak).toBe(1);
    s = reducer(reducer(s, { type: 'rollover', today: TUE }), { type: 'finishDay' });
    expect(s.streak).toBe(2);
    expect(reducer(s, { type: 'finishDay' }).streak).toBe(2); // closing twice doesn't count
    s = reducer(s, { type: 'rollover', today: THU }); // skipped Wednesday
    expect(s.streak).toBe(0);
  });

  it('counts gym days across the week', () => {
    let s = withTasks(MON);
    const gym = s.tasks.find(t => t.title.startsWith('Gym'))!;
    s = reducer(s, { type: 'toggleTask', id: gym.id });
    expect(gymThisWeek(s)).toBe(1);
    s = reducer(s, { type: 'rollover', today: TUE });
    expect(gymThisWeek(s)).toBe(1);
    s = reducer(s, { type: 'addTask', title: 'Gym — push', minutes: 1050 });
    s = reducer(s, { type: 'toggleTask', id: s.tasks.at(-1)!.id });
    expect(gymThisWeek(s)).toBe(2);
    expect(gymThisWeek(reducer(s, { type: 'rollover', today: '2026-11-02' }))).toBe(0); // new week
    expect(gymThisWeek(reducer(s, { type: 'rollover', today: WED }))).toBe(2);
  });

  it('un-commits when the plan changes, but not when ticking things off', () => {
    let s = reducer(withTasks(MON), { type: 'commit' });
    expect(reducer(s, { type: 'toggleTask', id: s.tasks[0].id }).committed).toBe(true);
    s = reducer(s, { type: 'shiftTask', id: s.tasks[0].id, delta: 30 });
    expect(s.committed).toBe(false);
    expect(s.tasks[0].minutes).toBe(660);
  });
});
