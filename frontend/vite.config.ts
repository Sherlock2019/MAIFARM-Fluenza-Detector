import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// start.sh / start.ps1 set these when the default ports are busy.
const webPort = Number(process.env.AIFARM_WEB_PORT) || 5500
const apiPort = Number(process.env.AIFARM_API_PORT) || 8000

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true, // reachable through a server's public DNS name (e.g. EC2), not only localhost
    port: webPort,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
})
