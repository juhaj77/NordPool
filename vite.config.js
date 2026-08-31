import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'https://www.sahkohinta-api.fi',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            },
            // Varalähde: käytetään jos sahkohinta-api.fi ei vielä tarjoa
            // huomisen hintoja (ks. requestBackupTomorrowPrices).
            '/api2': {
                target: 'https://www.porssisahkoa.fi',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api2/, '')
            }
        }
    }
})