import ICAL from 'ical.js';

export type CalEvent = {
  uid: string;
  title: string;
  location: string;
  start: number; // epoch ms
  end: number;
  allDay: boolean;
};

const MAX_OCCURRENCES = 2000;

/**
 * Parses an iCal feed and expands recurring events into the [from, to) window.
 * `lastStart` is when the feed's final event starts (Infinity for open-ended
 * recurrences), so the app can flag a feed that has stopped being updated.
 */
export function expandIcs(text: string, from: Date, to: Date): { events: CalEvent[]; lastStart: number } {
  const cal = new ICAL.Component(ICAL.parse(text));
  for (const tz of cal.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz); } catch { /* malformed zone: times fall back to floating */ }
  }

  const events = cal.getAllSubcomponents('vevent').map(v => new ICAL.Event(v));
  const masters = new Map<string, ICAL.Event>();
  for (const e of events) if (!e.isRecurrenceException()) masters.set(e.uid, e);
  for (const e of events) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);

  const lo = from.getTime(), hi = to.getTime();
  const out: CalEvent[] = [];
  let lastStart = -Infinity;
  const push = (item: ICAL.Event, s: ICAL.Time, e: ICAL.Time) => {
    if (String(item.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') return;
    const start = s.toJSDate().getTime();
    const end = Math.max(start, e.toJSDate().getTime());
    if (end <= lo || start >= hi) return;
    out.push({ uid: item.uid, title: item.summary || 'Untitled', location: item.location || '', start, end, allDay: s.isDate });
  };

  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      lastStart = Math.max(lastStart, ev.startDate.toJSDate().getTime());
      push(ev, ev.startDate, ev.endDate ?? ev.startDate);
      continue;
    }
    const it = ev.iterator();
    let t = it.next();
    for (let n = 0; t && n < MAX_OCCURRENCES; t = it.next(), n++) {
      if (t.toJSDate().getTime() >= hi) break;
      lastStart = Math.max(lastStart, t.toJSDate().getTime());
      const d = ev.getOccurrenceDetails(t);
      push(d.item, d.startDate, d.endDate);
    }
    // Still going past the window: open-ended unless the rule has an end.
    // (A COUNT rule that reaches past the window ends in the future, which is all we need to know.)
    const rule = ev.component.getFirstPropertyValue('rrule') as ICAL.Recur | null;
    if (t) lastStart = rule?.until ? Math.max(lastStart, rule.until.toJSDate().getTime()) : rule?.count ? Math.max(lastStart, hi) : Infinity;
  }
  return { events: out.sort((a, b) => a.start - b.start), lastStart };
}
