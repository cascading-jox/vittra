import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        target: 'esnext',
        sourcemap: true,
        minify: 'esbuild',
        lib: {
            entry: resolve(__dirname, 'lib/src/vittra.ts'),
            formats: ['es'],
            fileName: () => 'vittra.js',
        },
        rollupOptions: {
            output: {
                sourcemapExcludeSources: true,
                preserveModules: false,
                inlineDynamicImports: true,
            },
        },
        copyPublicDir: false,
    },
});
