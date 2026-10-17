import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Relative assets work at /Finlog/ on Pages as well as at / in local previews.
export default defineConfig({ base: './', plugins: [react()], server: { host: '127.0.0.1' } });
