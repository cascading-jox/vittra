import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        target: 'esnext',
        sourcemap: true,
        minify: 'esbuild',
        lib: {
            entry: resolve(__dirname, 'lib/src/av-log.ts'),
            formats: ['es'],
            fileName: () => 'av-log.js',
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
