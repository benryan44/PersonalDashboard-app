// Production server: serves the built app from dist/ plus the /api/ical proxy.
// Usage: npm run build && PORT=8080 npm start
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icalMiddleware } from './ical-proxy.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ico': 'image/x-icon',
};
const ical = icalMiddleware();

createServer((req, res) => ical(req, res, async () => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  try {
    if (!file.startsWith(root) || !(await stat(file)).isFile()) throw new Error();
  } catch {
    file = join(root, 'index.html');
  }
  res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
  if (file.includes(`${join(root, 'assets')}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.end(await readFile(file));
})).listen(Number(process.env.PORT) || 8080, () => console.log(`Daily Brief on http://localhost:${process.env.PORT || 8080}`));
