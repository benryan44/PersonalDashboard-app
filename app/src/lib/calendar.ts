import { useCallback, useEffect, useRef, useState } from 'react';
import { expandIcs, type CalEvent } from './ics';
import type { Feed } from './state';
import { addDays, fromKey } from './time';

export type FeedStatus = { state: 'syncing' | 'ok' | 'error'; error?: string; syncedAt?: number };
export type FeedEvent = CalEvent & { feedId: string };

type Cache = Record<string, { url: string; syncedAt: number; events: CalEvent[]; lastStart: number | null }>;

const CACHE_KEY = 'daily-brief:calendar-cache';
const REFRESH_MS = 30 * 60 * 1000;

const readCache = (): Cache => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const writeCache = (c: Cache) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* quota or private mode */ }
};

export const normalizeUrl = (url: string) => url.trim().replace(/^webcals?:\/\//i, 'https://');

/** Tries the same-origin proxy first (avoids CORS), then a direct fetch. */
async function download(url: string): Promise<string> {
  const target = normalizeUrl(url);
  let proxyError = '';
  try {
    const res = await fetch('/api/ical?url=' + encodeURIComponent(target));
    const text = await res.text();
    if (res.ok && text.includes('BEGIN:VCALENDAR')) return text;
    if (res.status !== 404) proxyError = text.slice(0, 80) || `Error ${res.status}`;
  } catch { /* no proxy (static hosting) */ }
  try {
    const res = await fetch(target);
    const text = await res.text();
    if (res.ok && text.includes('BEGIN:VCALENDAR')) return text;
    throw new Error(`Feed returned ${res.status}`);
  } catch (e) {
    throw new Error(proxyError || (e instanceof TypeError ? 'Blocked by the browser (CORS) — run with the proxy' : String((e as Error).message)));
  }
}

/** Keeps a window of events (yesterday → two weeks out) per feed, cached for offline use. */
export function useCalendars(feeds: Feed[], today: string) {
  const [cache, setCache] = useState<Cache>(readCache);
  const [status, setStatus] = useState<Record<string, FeedStatus>>({});
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;

  const sync = useCallback(async (only?: Feed[]) => {
    const from = fromKey(addDays(today, -1)), to = fromKey(addDays(today, 15));
    await Promise.all((only ?? feedsRef.current).filter(f => f.url).map(async f => {
      setStatus(s => ({ ...s, [f.id]: { ...s[f.id], state: 'syncing' } }));
      try {
        const { events, lastStart } = expandIcs(await download(f.url), from, to);
        // JSON can't hold Infinity, so open-ended feeds store null.
        const entry = { url: f.url, syncedAt: Date.now(), events, lastStart: Number.isFinite(lastStart) ? lastStart : null };
        setCache(c => { const next = { ...c, [f.id]: entry }; writeCache(next); return next; });
        setStatus(s => ({ ...s, [f.id]: { state: 'ok', syncedAt: entry.syncedAt } }));
      } catch (e) {
        setStatus(s => ({ ...s, [f.id]: { state: 'error', error: (e as Error).message } }));
      }
    }));
  }, [today]);

  // Sync on load, when the day changes, when a feed is added, on focus and every 30 minutes.
  const feedKey = feeds.map(f => f.id + f.url).join('|');
  useEffect(() => { sync(); }, [sync, feedKey]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    const timer = setInterval(sync, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [sync]);

  const dayStart = fromKey(today).getTime(), dayEnd = fromKey(addDays(today, 1)).getTime();
  const eventsFor = (feed: Feed): FeedEvent[] => {
    const c = cache[feed.id];
    if (!c || c.url !== feed.url) return [];
    return c.events.filter(e => e.start < dayEnd && e.end > dayStart).map(e => ({ ...e, feedId: feed.id }));
  };

  const today_ = feeds.filter(f => f.enabled).flatMap(eventsFor).sort((a, b) => a.start - b.start);
  const countToday = (feed: Feed) => eventsFor(feed).length;
  const hasData = (feed: Feed) => cache[feed.id]?.url === feed.url;
  /** When a feed's last event starts, if that's already in the past. */
  const endedAt = (feed: Feed) => {
    const last = hasData(feed) ? cache[feed.id].lastStart : null;
    return last !== null && last < dayStart ? last : null;
  };

  return { events: today_, status, countToday, hasData, endedAt, sync };
}
