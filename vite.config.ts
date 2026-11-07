import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Relative assets also support a repository subpath and arbitrary static hosting.
export default defineConfig({ plugins: [react()], base: './' });
