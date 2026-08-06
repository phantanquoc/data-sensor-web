import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend the dev/preview server proxies to.
// Trong Docker, compose truyền BACKEND_URL=http://iot-gateway:3000.
// Chạy ngoài Docker thì mặc định localhost:3000.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3000';

const proxy = {
  '/thong_ke': BACKEND,
  // Prefix này phủ luôn /get_noi_chien_chart và /get_noi_chien_detail
  '/get_noi_chien': BACKEND,
  '/sua_noi_chien_detail': BACKEND,
  '/xoa_noi_chien_detail': BACKEND,
  '/enable_machine': BACKEND,
  '/cai_dat_he_thong': BACKEND,
  '/socket.io': {
    target: BACKEND,
    ws: true,
  },
};

export default defineConfig(() => ({
  plugins: [react()],
  // React is the primary UI, mounted at `/` in both dev and the Docker production build.
  base: '/',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy,
    // Bind mount từ Windows vào container không phát sinh inotify event →
    // phải poll để HMR nhận thay đổi file.
    watch: { usePolling: true, interval: 300 },
  },
  preview: { proxy },
}));
