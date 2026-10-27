// Fetches an iCal feed server-side so the browser isn't blocked by CORS.
// Shared by the Vite dev/preview servers (vite.config.ts) and server.mjs.

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function isPrivateHost(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes(':')) return h === '::1' || /^(fc|fd|fe80)/.test(h);
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export async function fetchIcal(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl).trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    return { status: 400, body: 'Invalid URL' };
  }
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) return { status: 400, body: 'URL not allowed' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'text/calendar, */*' }, redirect: 'follow' });
    if (!res.ok) return { status: 502, body: `Feed returned ${res.status}` };
    const text = await res.text();
    if (text.length > MAX_BYTES) return { status: 502, body: 'Feed too large' };
    if (!text.includes('BEGIN:VCALENDAR')) return { status: 502, body: 'Not an iCal feed' };
    return { status: 200, body: text };
  } catch (e) {
    return { status: 502, body: e.name === 'AbortError' ? 'Feed timed out' : 'Could not reach feed' };
  } finally {
    clearTimeout(timer);
  }
}

// Connect-style middleware: GET /api/ical?url=<feed>
export function icalMiddleware() {
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/ical')) return next();
    const target = new URL(req.url, 'http://x').searchParams.get('url');
    const { status, body } = target ? await fetchIcal(target) : { status: 400, body: 'Missing url' };
    res.statusCode = status;
    res.setHeader('content-type', status === 200 ? 'text/calendar; charset=utf-8' : 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  };
}
