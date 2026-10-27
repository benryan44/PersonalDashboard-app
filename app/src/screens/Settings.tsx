import { useState, type Dispatch } from 'react';
import type { FeedStatus } from '../lib/calendar';
import { remindersFor, requestNotifications } from '../lib/reminders';
import type { Action, Feed, State } from '../lib/state';
import { fmt } from '../lib/time';

type Props = {
  s: State;
  dispatch: Dispatch<Action>;
  isDark: boolean;
  status: Record<string, FeedStatus>;
  countToday: (f: Feed) => number;
  hasData: (f: Feed) => boolean;
  endedAt: (f: Feed) => number | null;
  sync: () => void;
};

const source = (url: string) =>
  /google\.com/i.test(url) ? 'Google · iCal' : /outlook|office365|live\.com/i.test(url) ? 'Outlook · iCal' : /scientia|timetable/i.test(url) ? 'Timetable · iCal' : 'iCal';

function feedLine(f: Feed, st: FeedStatus | undefined, count: number, has: boolean, ended: number | null) {
  const parts = [source(f.url)];
  if (st?.state === 'syncing' && !has) parts.push('syncing…');
  else if (st?.state === 'error' && !has) parts.push(st.error ?? "couldn't sync");
  else if (has) {
    parts.push(count ? `${count} today` : 'nothing today');
    if (ended) parts.push(`feed ends ${new Date(ended).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);
    if (st?.state === 'error') parts.push('offline copy');
  }
  return parts.join(' · ');
}

export function Settings({ s, dispatch, isDark, status, countToday, hasData, endedAt, sync }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));

  const previews = remindersFor({ ...s, committed: true, finished: false });
  const firm = previews.find(r => r.label === 'Firm reminder');
  const shown = [
    { when: fmt(s.morning) + ' · Morning', text: 'Good morning. What are you doing today, and when?' },
    firm ? { when: fmt(firm.at) + ' · Firm reminder', text: firm.text } : { when: '15 min before · Firm reminder', text: 'Each committed task gets a heads-up before it starts.' },
    { when: fmt(s.evening) + ' · Evening', text: previews.find(r => r.key === 'evening')!.text },
  ];

  return (
    <div className="settings">
      <h1 className="settings-title">Settings</h1>

      <h6 className="section">Calendars</h6>
      {s.feeds.map(f => (
        <div className="card cal-row" key={f.id}>
          <div className="dot" style={{ background: f.color }} />
          <div className="grow">
            <div className="row-title">{f.name}</div>
            <div className="row-sub">{feedLine(f, status[f.id], countToday(f), hasData(f), endedAt(f))}</div>
          </div>
          <button className="remove" aria-label={`Remove ${f.name}`} onClick={() => confirm(`Remove ${f.name}?`) && dispatch({ type: 'removeFeed', id: f.id })}>×</button>
          <button className="toggle" role="switch" aria-checked={f.enabled} aria-label={`Show ${f.name}`} onClick={() => dispatch({ type: 'toggleFeed', id: f.id })} />
        </div>
      ))}
      {adding ? (
        <form className="add-feed" onSubmit={e => { e.preventDefault(); dispatch({ type: 'addFeed', name, url }); setName(''); setUrl(''); setAdding(false); }}>
          <input className="pill-input" value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. Work" />
          <input className="pill-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… .ics" inputMode="url" autoCapitalize="off" autoCorrect="off" required />
          <div className="hint">
            Google: Calendar settings → your calendar → Integrate calendar → <b>Secret address in iCal format</b>.
            Outlook: Settings → Calendar → Shared calendars → Publish → <b>ICS</b> link.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pill-btn" type="submit" style={{ flex: 1 }}>Connect</button>
            <button className="pill-btn" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="link-btn" onClick={() => setAdding(true)}>+ Add a calendar</button>
          <button className="link-btn" onClick={sync}>Refresh</button>
        </div>
      )}

      <h6 className="section">Check-in times</h6>
      <div className="group">
        {(['morning', 'evening'] as const).map(which => (
          <div className="group-row" key={which}>
            <div className="grow row-title">{which === 'morning' ? 'Morning plan' : 'Evening reflection'}</div>
            <button className="round" aria-label="30 minutes earlier" onClick={() => dispatch({ type: 'checkinTime', which, delta: -30 })}>−</button>
            <div className="time-val">{fmt(s[which])}</div>
            <button className="round" aria-label="30 minutes later" onClick={() => dispatch({ type: 'checkinTime', which, delta: 30 })}>+</button>
          </div>
        ))}
      </div>

      <h6 className="section">Appearance</h6>
      <div className="segmented" role="group" aria-label="Theme">
        {([['Light', false], ['Dark', true]] as const).map(([label, dark]) => (
          <button key={label} className="seg-btn" aria-pressed={isDark === dark} onClick={() => dispatch({ type: 'theme', theme: dark ? 'dark' : 'light' })}>{label}</button>
        ))}
      </div>

      <h6 className="section">Notification previews</h6>
      {shown.map(p => (
        <div className="preview" key={p.when}>
          <div className="app-dot" />
          <div className="grow"><div className="when">{p.when}</div><div className="text">{p.text}</div></div>
        </div>
      ))}
      {perm === 'default' && (
        <button className="link-btn" onClick={async () => setPerm(await requestNotifications())}>Turn on notifications</button>
      )}
      {perm === 'denied' && <div className="hint">Notifications are blocked for this site. Allow them in your browser settings.</div>}
      <div className="hint" style={{ marginTop: 6 }}>Reminders fire while the Daily Brief is open or running in the background.</div>
    </div>
  );
}
