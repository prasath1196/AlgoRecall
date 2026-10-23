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
                content: resolve(__dirname, 'content.js'),
                injected: resolve(__dirname, 'src/injected.js')
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === 'injected' || chunkInfo.name === 'content' || chunkInfo.name === 'background') {
                        return '[name].js';
                    }
                    return 'assets/[name]-[hash].js';
                },
                chunkFileNames: (chunkInfo) => {
                    // Force content/background/injected to be self-contained
                    if (chunkInfo.facadeModuleId?.includes('content.js') ||
                        chunkInfo.facadeModuleId?.includes('background.js') ||
                        chunkInfo.facadeModuleId?.includes('injected.js')) {
                        return '[name].js';
                    }
                    return 'assets/[name]-[hash].js';
                },
                assetFileNames: 'assets/[name]-[hash].[ext]',
                manualChunks: (id, { getModuleInfo }) => {
                    // Don't split chunks for content/background/injected - inline everything
                    const moduleInfo = getModuleInfo(id);
                    if (!moduleInfo) return;

                    // Check if this module is imported by content/background/injected
                    const importers = Array.from(moduleInfo.importers || []);
                    const isImportedByScript = importers.some(importer =>
                        importer.includes('content.js') ||
                        importer.includes('background.js') ||
                        importer.includes('injected.js')
                    );

                    if (isImportedByScript) {
                        return undefined; // Inline into the importing script
                    }

                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                }
            }
        },
        outDir: 'dist',
        emptyOutDir: true
    }
});
