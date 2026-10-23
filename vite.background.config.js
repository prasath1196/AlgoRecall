import { defineConfig } from 'vite';
import { resolve } from 'path';

// The service worker is built on its own so every dependency (db, sync, supabase-js) is inlined
// into a single self-contained dist/background.js with no chunk imports.
export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
            input: { background: resolve(__dirname, 'background.js') },
            output: {
                format: 'es',
                entryFileNames: '[name].js',
                inlineDynamicImports: true,
            },
        },
    },
});
