import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { icalMiddleware } from './ical-proxy.mjs';

const icalProxy = (): Plugin => ({
  name: 'ical-proxy',
  configureServer(server) { server.middlewares.use(icalMiddleware()); },
  configurePreviewServer(server) { server.middlewares.use(icalMiddleware()); },
});

export default defineConfig({
  plugins: [react(), icalProxy()],
  test: { environment: 'node' },
});
