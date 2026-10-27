import { addDays, clamp, weekStart, weekdayShort } from './time';

export type Task = {
  id: string;
  title: string;
  minutes: number; // planned start, minutes since midnight
  done: boolean;
  tag: string; // where it came from: "Added today", "Carried from Mon"
};

export type Feed = {
  id: string;
  name: string;
  url: string;
  color: string; // CSS colour / variable
  enabled: boolean;
};

export type DayLog = { date: string; mood: number; note: string; done: number; total: number };

export type State = {
  version: 1;
  day: string; // the day `tasks` belong to
  tasks: Task[];
  committed: boolean;
  mood: number;
  note: string;
  finished: boolean;
  morning: number; // check-in times, minutes since midnight
  evening: number;
  theme: 'light' | 'dark' | null; // null follows the system
  feeds: Feed[];
  streak: number;
  lastClosed: string | null;
  gymTarget: number;
  gymDays: string[]; // days a gym task was ticked off
  history: DayLog[];
};

export const FEED_COLORS = ['var(--ac)', 'var(--a2)', 'var(--act)', 'var(--a2d)', 'var(--mu)'];

export const COLLEGE_FEED_URL =
  'https://scientia-eu-v4-api-d4-01.azurewebsites.net//api/ical/50a55ae1-1c87-4dea-bb73-c9e67941e1fd/b3d0f831-51fd-4466-b62f-4dab3631f26d/timetable.ics';

export const initialState = (today: string): State => ({
  version: 1,
  day: today,
  tasks: [],
  committed: false,
  mood: 3,
  note: '',
  finished: false,
  morning: 450,
  evening: 1260,
  theme: null,
  feeds: [{ id: 'college', name: 'College', url: COLLEGE_FEED_URL, color: 'var(--a2)', enabled: true }],
  streak: 0,
  lastClosed: null,
  gymTarget: 4,
  gymDays: [],
  history: [],
});

export const isGym = (title: string) => /\b(gym|workout|lift|legs|push|pull|run|swim|cardio)\b/i.test(title);

/** Gym sessions this week, counting today live from the task list. */
export function gymThisWeek(s: State) {
  const from = weekStart(s.day);
  const past = new Set(s.gymDays.filter(d => d >= from && d !== s.day)).size;
  return past + (s.tasks.some(t => t.done && isGym(t.title)) ? 1 : 0);
}

export type Action =
  | { type: 'rollover'; today: string }
  | { type: 'toggleTask'; id: string }
  | { type: 'shiftTask'; id: string; delta: number }
  | { type: 'removeTask'; id: string }
  | { type: 'addTask'; title: string; minutes: number }
  | { type: 'commit' }
  | { type: 'mood'; mood: number }
  | { type: 'note'; note: string }
  | { type: 'finishDay' }
  | { type: 'checkinTime'; which: 'morning' | 'evening'; delta: number }
  | { type: 'theme'; theme: 'light' | 'dark' }
  | { type: 'toggleFeed'; id: string }
  | { type: 'addFeed'; name: string; url: string }
  | { type: 'removeFeed'; id: string };

const uid = () => Math.random().toString(36).slice(2, 10);

const logGym = (s: State) =>
  s.tasks.some(t => t.done && isGym(t.title)) && !s.gymDays.includes(s.day)
    ? [...s.gymDays, s.day].filter(d => d >= addDays(s.day, -60))
    : s.gymDays;

export function reducer(s: State, a: Action): State {
  const tasks = (fn: (t: Task) => Task | null, id: string) =>
    s.tasks.flatMap(t => (t.id === id ? (fn(t) ?? []) : t));

  switch (a.type) {
    case 'rollover': {
      if (a.today <= s.day) return s;
      // Unfinished work moves into the new day; done work drops off.
      const from = weekdayShort(s.day);
      const carried = s.tasks.filter(t => !t.done).map(t => ({ ...t, tag: t.tag.startsWith('Carried') ? t.tag : `Carried from ${from}` }));
      // The streak survives only if the last closed day was yesterday.
      const alive = s.lastClosed === addDays(a.today, -1);
      return {
        ...s, day: a.today, tasks: carried, committed: false, mood: 3, note: '', finished: false,
        gymDays: logGym(s), streak: alive ? s.streak : 0,
      };
    }
    case 'toggleTask':
      return { ...s, tasks: tasks(t => ({ ...t, done: !t.done }), a.id) };
    case 'shiftTask':
      return { ...s, committed: false, tasks: tasks(t => ({ ...t, minutes: clamp(t.minutes + a.delta) }), a.id) };
    case 'removeTask':
      return { ...s, committed: false, tasks: tasks(() => null, a.id) };
    case 'addTask': {
      const title = a.title.trim();
      if (!title) return s;
      return { ...s, committed: false, tasks: [...s.tasks, { id: uid(), title, minutes: clamp(a.minutes), done: false, tag: 'Added today' }] };
    }
    case 'commit':
      return s.tasks.length ? { ...s, committed: true } : s;
    case 'mood':
      return { ...s, mood: a.mood };
    case 'note':
      return { ...s, note: a.note };
    case 'finishDay': {
      if (s.finished) return s;
      const log = { date: s.day, mood: s.mood, note: s.note, done: s.tasks.filter(t => t.done).length, total: s.tasks.length };
      const continues = s.lastClosed === addDays(s.day, -1);
      return {
        ...s, finished: true, lastClosed: s.day, streak: continues ? s.streak + 1 : 1,
        gymDays: logGym(s), history: [...s.history.filter(h => h.date !== s.day), log].slice(-366),
      };
    }
    case 'checkinTime':
      return { ...s, [a.which]: clamp(s[a.which] + a.delta) };
    case 'theme':
      return { ...s, theme: a.theme };
    case 'toggleFeed':
      return { ...s, feeds: s.feeds.map(f => (f.id === a.id ? { ...f, enabled: !f.enabled } : f)) };
    case 'addFeed': {
      const url = a.url.trim();
      if (!url) return s;
      const color = FEED_COLORS[s.feeds.length % FEED_COLORS.length];
      return { ...s, feeds: [...s.feeds, { id: uid(), name: a.name.trim() || 'Calendar', url, color, enabled: true }] };
    }
    case 'removeFeed':
      return { ...s, feeds: s.feeds.filter(f => f.id !== a.id) };
  }
}

const KEY = 'daily-brief:v1';

export function load(today: string): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      if (saved.version === 1) return reducer({ ...initialState(today), ...saved }, { type: 'rollover', today });
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return initialState(today);
}

export function save(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
