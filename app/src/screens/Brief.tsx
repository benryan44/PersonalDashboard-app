import type { Dispatch } from 'react';
import type { FeedEvent } from '../lib/calendar';
import { gymThisWeek, type Action, type Feed, type State } from '../lib/state';
import { fmt, greeting, longDate, minutesOf } from '../lib/time';
import { eventMinutes, taskTag } from './shared';

type Props = { s: State; dispatch: Dispatch<Action>; events: FeedEvent[]; feeds: Feed[]; now: Date; goEvening: () => void };

const DEADLINE = /\b(due|deadline|submit|submission|exam|assessment|check-?ins?|hand-?in)\b/i;

type Item =
  | { kind: 'now'; m: number }
  | { kind: 'event'; m: number; ev: FeedEvent }
  | { kind: 'task'; m: number; id: string };

export function Brief({ s, dispatch, events, feeds, now, goEvening }: Props) {
  const nowMin = minutesOf(now);
  const color = (id: string) => feeds.find(f => f.id === id)?.color ?? 'var(--ac)';
  const left = s.tasks.filter(t => !t.done).length;

  const items: Item[] = [
    ...events.map(ev => ({ kind: 'event' as const, m: ev.allDay ? -1 : eventMinutes(ev, now).start, ev })),
    ...s.tasks.map(t => ({ kind: 'task' as const, m: t.minutes, id: t.id })),
    { kind: 'now' as const, m: nowMin },
  ].sort((a, b) => a.m - b.m || (a.kind === 'now' ? 1 : 0));

  // A deadline-looking event gets the chip; otherwise the next thing on the calendar does.
  const upcoming = events.filter(e => !e.allDay && e.end > now.getTime());
  const deadline = upcoming.find(e => DEADLINE.test(e.title));
  const next = deadline ?? upcoming[0];

  return (
    <>
      <div className="brief-head">
        <div>
          <div className="kicker">{longDate(now)}</div>
          <h1 className="title">{greeting(nowMin)}<br /><em>here's your day.</em></h1>
        </div>
        <div className="streak"><b>{s.streak}</b><span>DAY STREAK</span></div>
      </div>

      <div className="stats">
        <div className="stat"><b>{events.length}</b><span>{events.length === 1 ? 'event' : 'events'}</span></div>
        <div className="stat"><b>{left}<small>/{s.tasks.length}</small></b><span>plan left</span></div>
        <div className="stat sage"><b>{gymThisWeek(s)}<small>/{s.gymTarget}</small></b><span>gym this wk</span></div>
      </div>

      {next && (
        <div className="chip">
          {deadline ? `${next.title} due today · ${fmt(eventMinutes(next, now).start)}` : `Next up: ${next.title} · ${fmt(eventMinutes(next, now).start)}`}
        </div>
      )}

      <h6 className="section today">Today</h6>
      {!events.length && !s.tasks.length && (
        <div className="empty">Nothing on your calendars, nothing planned. Set your plan in Morning.</div>
      )}
      {items.map(it => {
        const time = it.m < 0 ? 'All' : fmt(it.m);
        if (it.kind === 'now') {
          return (
            <div className="tl" key="now">
              <div className="tl-time">{time}</div>
              <div className="tl-now"><i /><s />NOW</div>
            </div>
          );
        }
        if (it.kind === 'event') {
          const { ev } = it, span = eventMinutes(ev, now);
          return (
            <div className="tl" key={ev.feedId + ev.uid + ev.start}>
              <div className="tl-time">{time}</div>
              <div className="card shadow grow">
                <div className="dot" style={{ background: color(ev.feedId) }} />
                <div className="grow">
                  <div className="row-title">{ev.title}</div>
                  <div className="row-sub ellipsis">{ev.allDay ? 'All day' : `${fmt(span.start)}–${fmt(span.end)}`}{ev.location ? ' · ' + ev.location : ''}</div>
                </div>
              </div>
            </div>
          );
        }
        const t = s.tasks.find(x => x.id === it.id)!;
        return (
          <div className="tl" key={t.id}>
            <div className="tl-time">{time}</div>
            <button className={'tl-task' + (t.done ? ' done' : '')} onClick={() => dispatch({ type: 'toggleTask', id: t.id })} aria-pressed={t.done}>
              <div className={'check' + (t.done ? ' on' : '')}>{t.done ? '✓' : ''}</div>
              <div className="grow">
                <div className="row-title">{t.title}</div>
                <div className="row-sub">{s.committed ? 'Committed · ' + fmt(t.minutes) : taskTag(s, t)}</div>
              </div>
            </button>
          </div>
        );
      })}

      <button className="tonight" onClick={goEvening}>
        <span><small>Tonight · {fmt(s.evening)}</small><b>How was your day?</b></span>
        <span>→</span>
      </button>
    </>
  );
}
