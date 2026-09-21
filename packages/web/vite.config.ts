import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = 'http://localhost:3001';

// Development runs the same single-origin topology production does: vite owns
// the origin and hands /api and /ws to the game server. Nothing configures
// CORS anywhere because nothing is ever cross-origin.
//
// The Origin rewrite is the one piece of theatre. better-auth checks the
// inbound Origin against its own base URL and would see :5173 for a request it
// answers at :3001; `changeOrigin` only rewrites Host, not Origin.
const rewriteOrigin = (proxyReq: NodeReq): void => {
  if (proxyReq.getHeader('origin') !== undefined) proxyReq.setHeader('origin', API_TARGET);
};

const proxyToApi = {
  target: API_TARGET,
  changeOrigin: true,
  // Both events, because http-proxy emits proxyReq for a request and
  // proxyReqWs for an upgrade, and an upgrade that kept the vite origin would
  // fail the day anything checks it.
  configure: (proxy: { on: (e: string, fn: (req: NodeReq) => void) => void }) => {
    proxy.on('proxyReq', rewriteOrigin);
    proxy.on('proxyReqWs', rewriteOrigin);
  },
};

type NodeReq = {
  getHeader(name: string): unknown;
  setHeader(name: string, value: string): void;
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // strictPort because the browser suite is pinned to :5173, and a suite that
    // silently ran against whatever was already on the port would fail far from
    // the cause.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': proxyToApi,
      '/ws': { ...proxyToApi, ws: true },
    },
  },
});
