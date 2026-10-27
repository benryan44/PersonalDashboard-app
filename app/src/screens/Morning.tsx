import { useState, type Dispatch } from 'react';
import type { FeedEvent } from '../lib/calendar';
import type { Action, State } from '../lib/state';
import { fmt, minutesOf } from '../lib/time';
import { freeTimeLine, taskTag } from './shared';

type Props = { s: State; dispatch: Dispatch<Action>; events: FeedEvent[]; now: Date; onCommit: () => void };

export function Morning({ s, dispatch, events, now, onCommit }: Props) {
  const [draft, setDraft] = useState('');
  const add = () => {
    // New tasks land on the next half hour.
    dispatch({ type: 'addTask', title: draft, minutes: Math.ceil((minutesOf(now) + 1) / 30) * 30 });
    setDraft('');
  };

  return (
    <>
      <div className="kicker">Morning check-in · {fmt(s.morning)}</div>
      <h1 className="title">What's the plan,<br /><em>and when?</em></h1>
      <div className="lede">{freeTimeLine(events, now)}</div>

      {s.tasks.map(t => (
        <div className="card shadow plan-row" key={t.id}>
          <div className="grow">
            <div className="row-title">{t.title}</div>
            <div className="row-sub strong">{taskTag(s, t)}</div>
          </div>
          <button className="remove" aria-label={`Remove ${t.title}`} onClick={() => dispatch({ type: 'removeTask', id: t.id })}>×</button>
          <button className="round" aria-label="30 minutes earlier" onClick={() => dispatch({ type: 'shiftTask', id: t.id, delta: -30 })}>−</button>
          <div className="time-val">{fmt(t.minutes)}</div>
          <button className="round" aria-label="30 minutes later" onClick={() => dispatch({ type: 'shiftTask', id: t.id, delta: 30 })}>+</button>
        </div>
      ))}

      <form className="add-row" onSubmit={e => { e.preventDefault(); add(); }}>
        <input className="pill-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add something…" enterKeyHint="done" />
        <button className="pill-btn" type="submit">Add</button>
      </form>

      <button className={'cta' + (s.committed ? ' done' : '')} disabled={!s.tasks.length} onClick={onCommit}>
        {s.committed ? 'Committed ✓' : "I'm committing to this"}
      </button>
      <div className="note">
        {s.committed ? "I'll check in at each time." : s.tasks.length ? "I'll nudge you at each time and ask tonight how it went." : 'Add at least one thing to commit to.'}
      </div>
    </>
  );
}
