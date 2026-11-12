import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Strudel is loaded on demand; pre-bundling it up front avoids a dev-server reload on first play.
  optimizeDeps: { include: ['@strudel/web'] },
})
