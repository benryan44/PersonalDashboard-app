import type { Dispatch } from 'react';
import type { Action, State } from '../lib/state';
import { fmt } from '../lib/time';

type Props = { s: State; dispatch: Dispatch<Action>; onFinish: () => void };

export const MOODS = ['Rough', 'Meh', 'Okay', 'Good', 'Great'];

export function Evening({ s, dispatch, onFinish }: Props) {
  const missed = s.tasks.filter(t => !t.done).length;
  const tasksWord = (n: number) => n + ' task' + (n > 1 ? 's' : '');

  return (
    <>
      <div className="kicker">Evening reflection · {fmt(s.evening)}</div>
      <h1 className="title">How was<br /><em>your day?</em></h1>
      <div className="moods" role="group" aria-label="Mood">
        {MOODS.map((label, i) => (
          <button key={label} className="seg-btn" aria-pressed={s.mood === i} onClick={() => dispatch({ type: 'mood', mood: i })}>{label}</button>
        ))}
      </div>

      <h6 className="section">What got done?</h6>
      {!s.tasks.length && <div className="empty">No plan today. Set one tomorrow morning.</div>}
      {s.tasks.map(t => (
        <button className="card shadow eve-row" key={t.id} aria-pressed={t.done} onClick={() => dispatch({ type: 'toggleTask', id: t.id })}>
          <div className={'check' + (t.done ? ' on' : '')}>{t.done ? '✓' : ''}</div>
          <div className="grow">
            <div className="row-title">{t.title}</div>
            <div className="row-sub">{t.done ? 'Done at ' + fmt(t.minutes) : 'Not done → moves to tomorrow'}</div>
          </div>
        </button>
      ))}

      <h6 className="section spaced">One line on today</h6>
      <input className="line-input" value={s.note} onChange={e => dispatch({ type: 'note', note: e.target.value })} placeholder="What stood out?" />

      <button className={'cta' + (s.finished ? ' done' : '')} style={{ marginTop: 18 }} onClick={onFinish}>
        {s.finished ? 'Day closed ✓' : 'Close the day'}
      </button>
      <div className="note">
        {s.finished
          ? (missed ? `${tasksWord(missed)} queued for tomorrow morning.` : 'Nothing left over.')
          : (missed ? `${missed} unfinished will carry into tomorrow's plan.` : 'Everything done — nice.')}
      </div>
    </>
  );
}
