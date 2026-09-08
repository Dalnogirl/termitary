import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // strictPort because the server's CORS allowlist and better-auth
    // trustedOrigins are pinned to :5173. Drifting to :5174 when the port is
    // taken would silently break every credentialed request.
    port: 5173,
    strictPort: true,
  },
});
