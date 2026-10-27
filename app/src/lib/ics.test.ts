import { describe, expect, it } from 'vitest';
import { expandIcs } from './ics';

// Shaped like a Google secret-address export: VTIMEZONE, a weekly shift with a
// moved and a cancelled occurrence, an all-day event and a one-off in UTC.
const FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:Europe/Dublin
BEGIN:STANDARD
TZOFFSETFROM:+0100
TZOFFSETTO:+0000
TZNAME:GMT
DTSTART:19701025T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETFROM:+0000
TZOFFSETTO:+0100
TZNAME:IST
DTSTART:19700329T010000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:shift@x
DTSTART;TZID=Europe/Dublin:20261006T170000
DTEND;TZID=Europe/Dublin:20261006T210000
RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261124T235959Z
SUMMARY:Evening shift
LOCATION:Gym floor
END:VEVENT
BEGIN:VEVENT
UID:shift@x
RECURRENCE-ID;TZID=Europe/Dublin:20261020T170000
DTSTART;TZID=Europe/Dublin:20261020T180000
DTEND;TZID=Europe/Dublin:20261020T220000
SUMMARY:Evening shift (late)
END:VEVENT
BEGIN:VEVENT
UID:shift@x
RECURRENCE-ID;TZID=Europe/Dublin:20261103T170000
DTSTART;TZID=Europe/Dublin:20261103T170000
DTEND;TZID=Europe/Dublin:20261103T210000
STATUS:CANCELLED
SUMMARY:Evening shift
END:VEVENT
BEGIN:VEVENT
UID:checkins@x
DTSTART:20261027T120000Z
DTEND:20261027T130000Z
SUMMARY:End of month check-ins
LOCATION:Google Meet
END:VEVENT
BEGIN:VEVENT
UID:bank@x
DTSTART;VALUE=DATE:20261026
DTEND;VALUE=DATE:20261027
SUMMARY:Bank holiday
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '\r\n');

const iso = (ms: number) => new Date(ms).toISOString();

describe('expandIcs', () => {
  it('expands recurrences in the window, applying exceptions and dropping cancellations', () => {
    const { events } = expandIcs(FEED, new Date('2026-10-13T00:00:00Z'), new Date('2026-11-11T00:00:00Z'));
    const shifts = events.filter(e => e.uid === 'shift@x');
    expect(shifts.map(e => [e.title, iso(e.start)])).toEqual([
      ['Evening shift', '2026-10-13T16:00:00.000Z'], // IST, UTC+1
      ['Evening shift (late)', '2026-10-20T17:00:00.000Z'], // moved occurrence
      ['Evening shift', '2026-10-27T17:00:00.000Z'], // GMT after the clocks change
      ['Evening shift', '2026-11-10T17:00:00.000Z'], // 3 Nov cancelled
    ]);
    expect(shifts[0].location).toBe('Gym floor');
  });

  it('reads UTC and all-day events', () => {
    const { events } = expandIcs(FEED, new Date('2026-10-26T00:00:00Z'), new Date('2026-10-28T00:00:00Z'));
    const checkins = events.find(e => e.uid === 'checkins@x')!;
    expect(iso(checkins.start)).toBe('2026-10-27T12:00:00.000Z');
    expect(checkins.allDay).toBe(false);
    expect(events.find(e => e.uid === 'bank@x')?.allDay).toBe(true);
  });

  it('reports when the feed runs out, so stale timetables can be flagged', () => {
    const { lastStart } = expandIcs(FEED, new Date('2026-12-01T00:00:00Z'), new Date('2026-12-15T00:00:00Z'));
    expect(iso(lastStart)).toBe('2026-11-24T17:00:00.000Z');
  });

  it('treats open-ended recurrences as never ending', () => {
    const open = FEED.replace(';UNTIL=20261124T235959Z', '');
    expect(expandIcs(open, new Date('2026-10-01'), new Date('2026-10-15')).lastStart).toBe(Infinity);
  });
});
