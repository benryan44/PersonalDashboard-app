import type { FeedEvent } from '../lib/calendar';
import { gymThisWeek, isGym, type State, type Task } from '../lib/state';
import { fmt } from '../lib/time';

/** An event's start/end as minutes into `day`, clipped to that day. */
export function eventMinutes(ev: FeedEvent, day: Date) {
  const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const toMin = (t: number) => Math.round((t - midnight) / 60000);
  return { start: Math.max(0, toMin(ev.start)), end: Math.min(1440, toMin(ev.end)) };
}

/** Gym tasks show the weekly goal; everything else shows where it came from. */
export const taskTag = (s: State, t: Task) =>
  isGym(t.title) ? `Goal · ${gymThisWeek(s)}/${s.gymTarget} this week` : t.tag;

/** "Check-ins are at 12:00, so you're clear before that and after 13:00." */
export function freeTimeLine(events: FeedEvent[], day: Date) {
  const timed = events.filter(e => !e.allDay).map(e => ({ title: e.title, ...eventMinutes(e, day) }));
  if (!timed.length) return "Your calendar's clear today. Pick a time for each — I'll hold you to it.";
  if (timed.length === 1) {
    const [e] = timed;
    return `${e.title} is at ${fmt(e.start)}, so you're clear before that and after ${fmt(e.end)}. Pick a time for each — I'll hold you to it.`;
  }
  const spans = timed.slice(0, 4).map(e => `${fmt(e.start)}–${fmt(e.end)}`).join(', ');
  return `You're booked ${spans}${timed.length > 4 ? ' and more' : ''}. Pick a time for each around those — I'll hold you to it.`;
}
