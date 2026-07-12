import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

/**
 * sourcemapIgnoreList only emits the legacy x_google_ignoreList field;
 * mirror it into the standardized ignoreList field (Firefox, newer tooling).
 */
function standardIgnoreListField(): Plugin {
    return {
        name: 'standard-ignore-list-field',
        writeBundle(options, bundle) {
            for (const fileName of Object.keys(bundle)) {
                if (!fileName.endsWith('.js.map')) continue;
                const mapPath = resolve(options.dir ?? 'dist', fileName);
                const map = JSON.parse(readFileSync(mapPath, 'utf8'));
                if (map.x_google_ignoreList && !map.ignoreList) {
                    map.ignoreList = map.x_google_ignoreList;
                    writeFileSync(mapPath, JSON.stringify(map));
                }
            }
        },
    };
}

export default defineConfig({
    plugins: [standardIgnoreListField()],
    build: {
        target: 'esnext',
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, 'lib/src/vittra.ts'),
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
