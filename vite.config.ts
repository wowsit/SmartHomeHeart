import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLEFILE=1 npm run build  -> one self-contained index.html (demo/preview)
// npm run build               -> normal multi-file build for nginx
export default defineConfig({
  plugins: [react(), ...(process.env.SINGLEFILE ? [viteSingleFile()] : [])],
  server: { host: true, port: 5173 },
})
