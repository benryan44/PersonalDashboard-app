/** Minutes since midnight → "HH:MM". */
export const fmt = (m: number) =>
  String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');

export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Local calendar day as "YYYY-MM-DD". */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** Monday of the week containing `key`. */
export const weekStart = (key: string) => addDays(key, -((fromKey(key).getDay() + 6) % 7));

export const weekdayShort = (key: string) => fromKey(key).toLocaleDateString('en-GB', { weekday: 'short' });

/** "Tuesday · 27 October" */
export const longDate = (d: Date) =>
  `${d.toLocaleDateString('en-GB', { weekday: 'long' })} · ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;

export const greeting = (m: number) => (m < 720 ? 'Good morning,' : m < 1080 ? 'Good afternoon,' : 'Good evening,');

export const clamp = (m: number) => Math.max(0, Math.min(1410, m));
