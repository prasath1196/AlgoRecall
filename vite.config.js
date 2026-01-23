import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                dashboard: resolve(__dirname, 'src/dashboard/index.html'),
                popup: resolve(__dirname, 'popup.html'), // Keeping original popup if simpler, or move to src
                background: resolve(__dirname, 'background.js'),
                content: resolve(__dirname, 'content.js'),
                injected: resolve(__dirname, 'src/injected.js')
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === 'injected' || chunkInfo.name === 'content' || chunkInfo.name === 'background') {
                        return '[name].js'; // Keep these standard naming for manifest/injection
                    }
                    return 'assets/[name]-[hash].js';
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        },
        outDir: 'dist',
        emptyOutDir: true
    }
});
