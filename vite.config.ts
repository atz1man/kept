/// <reference types="vitest" />
import { defineConfig, type Plugin, type Rollup } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Where sw.js keeps the list this plugin writes — an empty array until stamped. */
const BUILD_FILES = '[/* __BUILD_FILES__ */]';

/**
 * The files the app document can load: its entry chunk, everything that chunk
 * imports — statically or lazily, so reading a PDF and scanning a receipt are
 * in it — and the stylesheets and assets those bring. Read from the bundle's
 * own graph rather than kept as a list, which is the stale list sw.js used to
 * refuse to have. The landing, privacy and rights pages are outside the
 * worker's scope and are not walked; `ocr/` is fetched by tesseract's own
 * worker, ten megabytes of it, and is not either.
 */
function appFiles(bundle: Rollup.OutputBundle, appHtml: string): string[] {
  const entry = Object.values(bundle).find(
    (f): f is Rollup.OutputChunk => f.type === 'chunk' && f.isEntry && f.facadeModuleId === appHtml,
  );
  if (!entry) return [];
  const files = new Set<string>();
  const visit = (fileName: string) => {
    if (files.has(fileName)) return;
    files.add(fileName);
    const chunk = bundle[fileName];
    if (chunk?.type !== 'chunk') return;
    for (const css of chunk.viteMetadata?.importedCss ?? []) files.add(css);
    for (const asset of chunk.viteMetadata?.importedAssets ?? []) files.add(asset);
    for (const next of [...chunk.imports, ...chunk.dynamicImports]) visit(next);
  };
  visit(entry.fileName);
  return [...files].sort();
}

/**
 * Give each build's service worker its own cache name, and the list of files
 * it must hold before it may take over.
 *
 * sw.js is served verbatim from public/, so nothing else in the pipeline can
 * tell it what changed. The id is derived from the emitted asset filenames
 * rather than the clock: rebuilding identical code leaves the name alone, so
 * users are not made to re-download a byte-identical app.
 *
 * The list is what the worker precaches. Without it the worker held the shell
 * and nothing the shell names, and the app was a white screen offline after a
 * first visit and after every deploy — see sw.js for what was measured.
 */
function stampServiceWorker(): Plugin {
  /*
   * Read from the resolved config rather than written here, because this
   * plugin knew only one output directory and there are now two. `npm run
   * build:ios` builds to `dist-ios`, and with the path hardcoded this stamped
   * the WEB build's worker using the WEB build's manifest, then left the iOS
   * worker holding a literal `__BUILD_ID__` — a cache name that never changes,
   * which is the never-evicting worker the loud failure below exists to
   * prevent. It reported "no placeholder to stamp", which was true of the file
   * it was looking at and false of the one it was building.
   */
  let outDir = 'dist';
  let root = __dirname;
  let base = '/';
  let files: string[] = [];
  return {
    name: 'kept-stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
      root = config.root;
      base = config.base;
    },
    generateBundle(_options, bundle) {
      files = appFiles(bundle, resolve(root, 'app/index.html'));
    },
    closeBundle() {
      const swPath = resolve(__dirname, outDir, 'sw.js');
      let sw: string;
      try {
        sw = readFileSync(swPath, 'utf8');
      } catch {
        return; // No service worker emitted (a partial build); nothing to stamp.
      }
      if (!sw.includes('__BUILD_ID__')) {
        // Fail loudly rather than shipping a worker that can never evict: a
        // renamed placeholder would otherwise be a silent regression.
        this.error('sw.js has no __BUILD_ID__ placeholder to stamp');
      }
      // The same for the list: unstamped, it is empty, and an empty precache
      // is the white screen this list exists to end — silently.
      if (!sw.includes(BUILD_FILES)) this.error(`sw.js has no ${BUILD_FILES} placeholder to stamp`);
      const manifest = readFileSync(resolve(__dirname, outDir, 'app/index.html'), 'utf8');
      /*
       * And the list has to hold everything the shell loads, or the worker
       * would precache a shell that names files it does not have. Asked of the
       * emitted document rather than assumed from the walk, because a walk
       * that found nothing — the entry renamed, the input moved — would
       * otherwise stamp an empty list and report success.
       */
      const named = [...manifest.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((m) => m[1]);
      const missing = named.filter((f) => !files.includes(f));
      if (named.length === 0 || missing.length > 0) {
        this.error(`the app's precache list misses what its shell loads: ${missing.join(', ') || 'no /assets/ files named at all'}`);
      }
      const id = createHash('sha256').update(manifest).digest('hex').slice(0, 12);
      const list = JSON.stringify(files.map((f) => base + f));
      writeFileSync(swPath, sw.replaceAll('__BUILD_ID__', id).replace(BUILD_FILES, list));
    },
  };
}

/**
 * The on-device text reader for scanned receipts, served from this app.
 *
 * tesseract.js loads its worker, its WebAssembly core and its language model
 * from a public CDN unless told otherwise — which would hand a third party the
 * IP address of everyone who scans a receipt, and break scanning offline and
 * inside the iOS app. These are the same files, from node_modules, emitted at
 * fixed paths under `ocr/` in every build (the web one and `dist-ios`) and
 * served from the same paths in development. Fixed rather than hashed because
 * tesseract finds the core and the model by directory, not by import.
 *
 * Three cores: tesseract picks the fastest the device supports (relaxed SIMD,
 * SIMD, or neither). All three are the LSTM-only builds, which is the engine
 * `scan.ts` asks for. Nothing here is in the main bundle — `scan.ts` imports
 * tesseract.js lazily, when someone first chooses to scan.
 */
const OCR_FILES: Record<string, string> = {
  'ocr/worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'ocr/tesseract-core-relaxedsimd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'ocr/tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'ocr/tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'ocr/eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
};

function serveOcrFiles(): Plugin {
  return {
    name: 'kept-ocr-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/^\//, '');
        const from = OCR_FILES[path];
        if (!from) return next();
        res.setHeader('Content-Type', path.endsWith('.gz') ? 'application/gzip' : 'text/javascript');
        res.end(readFileSync(resolve(__dirname, from)));
      });
    },
    generateBundle() {
      for (const [fileName, from] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(__dirname, from)) });
      }
    },
  };
}

/**
 * The version a person can quote to support, from package.json — and only
 * that. Not the git commit: stamping the commit would change the bundle's
 * bytes on every commit, docs-only ones included, and the service worker's
 * cache name is derived from those bytes, so every user would re-download a
 * byte-identical app. The build itself is identified at runtime from that
 * cache name instead (see lib/support.ts).
 */
const VERSION = (JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string }).version;

export default defineConfig({
  define: { __KEPT_VERSION__: JSON.stringify(VERSION) },
  plugins: [react(), stampServiceWorker(), serveOcrFiles()],
  server: { port: 5183 },
  build: {
    rollupOptions: {
      // Two entries, not one SPA: the landing page is a marketing document that
      // must paint without booting the app, and the app is a PWA whose service
      // worker scope is /app/. Sharing one bundle would put the whole receipt
      // app on the critical path of a page that only needs to sell it.
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        // Its own entry so it is in the iOS bundle as well, where Settings links
        // to it with no network — see src/privacy/Privacy.tsx.
        privacy: resolve(__dirname, 'privacy/index.html'),
        rights: resolve(__dirname, 'rights/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    /*
     * A non-UK, DST-observing zone, ON PURPOSE — and set HERE rather than only
     * in the npm script, which is where it used to live alone.
     *
     * The point of the zone is that a date parsed as UTC midnight still lands
     * on the right calendar day in UTC or London, so the timezone bugs these
     * tests exist to catch would pass unnoticed. That works only if the zone is
     * actually in effect. It was set by `npm test` and nothing else, so
     * `npx vitest run` — the obvious thing to type, and what I ran all day —
     * used the container's UTC and every DST test passed for the wrong reason.
     * Measured: mutate `Math.round` to `Math.floor` in `daysBetween`, which is
     * the truncating divide that loses a day each spring, and the suite is
     * green under `npx vitest run` and red under `npm test`.
     *
     * `test/timezone.test.ts` holds this setting to the property it is for, so
     * it cannot go quiet again.
     */
    env: { TZ: 'America/New_York' },
  },
});
