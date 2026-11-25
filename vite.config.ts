import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        target: 'esnext',
        sourcemap: true,
        lib: {
            entry: resolve(import.meta.dirname, 'lib/src/vittra.ts'),
            formats: ['es'],
            fileName: () => 'vittra.js',
        },
        rollupOptions: {
            output: {
                // The npm package ships only dist/, so the map must carry the
                // source text itself for DevTools to display it
                sourcemapExcludeSources: false,
                preserveModules: false,
                // Mark vittra as ignore-listed so DevTools attributes console
                // rows to the caller's source line instead of vittra internals
                sourcemapIgnoreList: () => true,
            },
        },
        copyPublicDir: false,
    },
});
