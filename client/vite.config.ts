import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend the dev/preview server proxies to. Default targets the
// docker-compose gateway (host port 3001 → container port 3000).
// Override with BACKEND_URL if running the backend on a different port.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';

const proxy = {
  '/get_noi_chien': BACKEND,
  '/get_noi_chien_detail': BACKEND,
  '/xoa_noi_chien_detail': BACKEND,
  '/enable_machine': BACKEND,
  '/socket.io': {
    target: BACKEND,
    ws: true,
  },
};

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: { proxy },
  preview: { proxy },
});
