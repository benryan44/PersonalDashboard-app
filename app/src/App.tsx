import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useCalendars } from './lib/calendar';
import { useReminders } from './lib/reminders';
import { load, reducer, save } from './lib/state';
import { dayKey, fmt, minutesOf } from './lib/time';
import { Brief } from './screens/Brief';
import { Evening } from './screens/Evening';
import { Morning } from './screens/Morning';
import { Settings } from './screens/Settings';

type Tab = 'brief' | 'morning' | 'evening' | 'settings';
const TABS: [Tab, string][] = [['brief', 'Brief'], ['morning', 'Morning'], ['evening', 'Evening'], ['settings', 'Settings']];

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}

function useSystemDark() {
  const q = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q), on = () => setDark(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return dark;
}

function useNudge() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setText(null), 3600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { text, show };
}

const initialTab = (): Tab => {
  const t = new URLSearchParams(location.search).get('tab');
  return TABS.some(([k]) => k === t) ? (t as Tab) : 'brief';
};

export function App() {
  const now = useNow();
  const today = dayKey(now);
  const [s, dispatch] = useReducer(reducer, today, load);
  const [tab, setTab] = useState<Tab>(initialTab);
  const nudge = useNudge();
  const cal = useCalendars(s.feeds, today);
  const systemDark = useSystemDark();
  const isDark = s.theme ? s.theme === 'dark' : systemDark;

  useEffect(() => { save(s); }, [s]);
  useEffect(() => { dispatch({ type: 'rollover', today }); }, [today]);
  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', isDark ? '#1c1813' : '#f5ead8');
  }, [isDark]);
  useReminders(s, minutesOf(now), nudge.show);

  // Notification taps open the app on the right tab.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.tab) setTab(e.data.tab); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);

  const go = (t: Tab) => { setTab(t); screen.current?.scrollTo({ top: 0 }); };
  const screen = useRef<HTMLDivElement>(null);

  const commit = () => {
    if (!s.tasks.length) return;
    dispatch({ type: 'commit' });
    const first = [...s.tasks].filter(t => !t.done).sort((a, b) => a.minutes - b.minutes)[0] ?? s.tasks[0];
    nudge.show(`Locked in. First up: ${first.title} at ${fmt(first.minutes)}.`);
    setTimeout(() => go('brief'), 900);
  };

  const finish = () => {
    if (s.finished) return;
    const missed = s.tasks.filter(t => !t.done).length;
    const streak = s.lastClosed && s.lastClosed >= today ? s.streak : s.streak + 1;
    dispatch({ type: 'finishDay' });
    nudge.show(missed ? `${missed} carried to tomorrow. Sleep well.` : `Clean sweep. Streak: ${streak}.`);
  };

  return (
    <div className="stage">
      <div className="device">
        <div className="statusbar" aria-hidden><span>{fmt(minutesOf(now))}</span><div className="island" /><span className="signal">5G ▪▪▪</span></div>

        <main className="screen" ref={screen}>
          {tab === 'brief' && <Brief s={s} dispatch={dispatch} events={cal.events} feeds={s.feeds} now={now} goEvening={() => go('evening')} />}
          {tab === 'morning' && <Morning s={s} dispatch={dispatch} events={cal.events} now={now} onCommit={commit} />}
          {tab === 'evening' && <Evening s={s} dispatch={dispatch} onFinish={finish} />}
          {tab === 'settings' && (
            <Settings s={s} dispatch={dispatch} isDark={isDark} status={cal.status} countToday={cal.countToday} hasData={cal.hasData} endedAt={cal.endedAt} sync={() => cal.sync()} />
          )}
        </main>

        {nudge.text && (
          <div className="nudge" role="status">
            <div className="app-dot" />
            <div className="grow"><small>DAILY BRIEF · now</small><b>{nudge.text}</b></div>
          </div>
        )}

        <nav className="tabbar">
          {TABS.map(([k, label]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>{label}</button>
          ))}
        </nav>
        <div className="home-indicator" aria-hidden />
      </div>
    </div>
  );
}
