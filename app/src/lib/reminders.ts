import { useEffect } from 'react';
import { gymThisWeek, isGym, type State } from './state';
import { fmt } from './time';

export type Reminder = { key: string; at: number; label: string; text: string; tab: 'morning' | 'evening' | 'brief' };

export const FIRM_LEAD = 15; // minutes before a committed task

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Everything the app will nudge about today, in time order. Also drives the Settings previews. */
export function remindersFor(s: State): Reminder[] {
  const left = s.tasks.filter(t => !t.done);
  const out: Reminder[] = [];
  if (!s.committed) out.push({ key: 'morning', at: s.morning, label: 'Morning', text: 'Good morning. What are you doing today, and when?', tab: 'morning' });
  if (s.committed) {
    for (const t of left) {
      const stake = isGym(t.title) && gymThisWeek(s) < s.gymTarget ? 'your weekly goal' : 'your streak';
      out.push({ key: 'task:' + t.id + ':' + t.minutes, at: Math.max(0, t.minutes - FIRM_LEAD), label: 'Firm reminder', text: `${t.title} at ${fmt(t.minutes)}. Be there — ${stake} is on the line.`, tab: 'brief' });
    }
  }
  if (!s.finished) {
    out.push({ key: 'evening', at: s.evening, label: 'Evening', text: left.length ? `How was today? ${plural(left.length, 'thing')} didn't get done.` : 'How was today? Time to close the day.', tab: 'evening' });
  }
  return out.sort((a, b) => a.at - b.at);
}

export async function requestNotifications() {
  if (!('Notification' in window)) return 'unsupported' as const;
  return Notification.requestPermission();
}

async function systemNotify(r: Reminder) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: r.text, tag: r.key, icon: '/icon-192.png', badge: '/icon-192.png', data: { tab: r.tab } };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification('Daily Brief', opts);
  else new Notification('Daily Brief', opts);
}

const FIRED_KEY = 'daily-brief:fired';
const readFired = (day: string): string[] => {
  try {
    const f = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
    return f.day === day ? f.keys : [];
  } catch { return []; }
};
const writeFired = (day: string, keys: string[]) => {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify({ day, keys })); } catch { /* ignore */ }
};

/** Fires each reminder once, within a few minutes of its time, while the app is running. */
export function useReminders(s: State, nowMin: number, nudge: (text: string) => void) {
  useEffect(() => {
    const fired = readFired(s.day);
    const due = remindersFor(s).filter(r => nowMin >= r.at && nowMin < r.at + 5 && !fired.includes(r.key));
    if (!due.length) return;
    writeFired(s.day, [...fired, ...due.map(r => r.key)]);
    for (const r of due) systemNotify(r);
    nudge(due[due.length - 1].text);
  }, [s, nowMin, nudge]);
}
