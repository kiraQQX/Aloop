import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Documents served verbatim in development. They are classic H5 pages: Vite's
// HTML transform would try to resolve their import map and module graph.
const legacyDocuments = ['/legacy.html', '/说明.html'];
// Historical single-file reference, kept for comparison/rollback only. It is
// deliberately reachable in development but never copied into the build.
const referenceDocuments = ['/standalone.html'];
const legacyStaticPrefixes = ['/assets/', '/experiments/'];
// Every artefact the production build must contain for index.html to work.
const requiredBuildOutput = [
  'index.html',
  'legacy.html',
  '说明.html',
  'assets/js/core/router.js',
  'assets/js/core/env.js',
  'assets/i18n/site.js',
  'assets/js/easysci/data.js',
  'assets/js/smartbrain/atlas/scene.js',
  'assets/models/atlas/brain.glb',
  'assets/models/atlas/manifest.json',
  'assets/models/atlas/draco/draco_decoder.wasm',
  'experiments/believe/runtime.js',
  'experiments/believe/believe.css',
];
// A second production homepage would fork the release; never ship it.
const forbiddenBuildOutput = ['standalone.html'];
const legacyMimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
};

const serveLegacyRuntime = {
  name: 'serve-legacy-runtime-without-vite-transforms',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const [pathname] = (request.url || '').split('?');
      let decodedPath = pathname;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        // Leave malformed URLs to Vite's normal request handling.
      }

      // The iframe runtime must remain a classic static H5 site in dev: Vite's
      // HTML transform crawls module scripts and cannot resolve the legacy import map.
      const isLegacyDocument = legacyDocuments.includes(decodedPath) || referenceDocuments.includes(decodedPath);
      const isLegacyAsset = legacyStaticPrefixes.some((prefix) => decodedPath.startsWith(prefix));
      if (!isLegacyDocument && !isLegacyAsset) {
        next();
        return;
      }

      const filePath = resolve(projectRoot, `.${decodedPath}`);
      if (!filePath.startsWith(`${projectRoot}${sep}`)) {
        response.statusCode = 403;
        response.end('Forbidden');
        return;
      }

      try {
        const data = await readFile(filePath);
        response.statusCode = 200;
        response.setHeader('Content-Type', legacyMimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-cache');
        // Historical documents are reference material, not indexable production pages.
        if (referenceDocuments.includes(decodedPath)) response.setHeader('X-Robots-Tag', 'noindex, nofollow');
        response.setHeader('Content-Length', String(data.byteLength));
        response.end(data);
      } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'EISDIR') {
          next();
          return;
        }
        next(error);
      }
    });
  },
};

// Rollup runs closeBundle hooks in parallel across plugins, so the verification
// hook awaits the copy task started by the plugin above it.
let runtimeCopyTask = Promise.resolve();

const copyLegacyRuntime = {
  name: 'copy-legacy-runtime',
  apply: 'build',
  closeBundle() {
    runtimeCopyTask = (async () => {
      const output = resolve(projectRoot, 'dist');
      await mkdir(output, { recursive: true });
      await cp(resolve(projectRoot, 'legacy.html'), resolve(output, 'legacy.html'));
      await cp(resolve(projectRoot, 'assets'), resolve(output, 'assets'), { recursive: true });
      await cp(resolve(projectRoot, 'experiments'), resolve(output, 'experiments'), { recursive: true });
      await cp(resolve(projectRoot, '说明.html'), resolve(output, '说明.html'));
    })();
    return runtimeCopyTask;
  },
};

const verifyProductionOutput = {
  name: 'verify-production-output',
  apply: 'build',
  enforce: 'post',
  async closeBundle() {
    await runtimeCopyTask;
    const output = resolve(projectRoot, 'dist');
    const missing = [];
    for (const relativePath of requiredBuildOutput) {
      const filePath = resolve(output, relativePath);
      try {
        const info = await stat(filePath);
        if (!info.isFile() || info.size === 0) missing.push(relativePath);
      } catch {
        missing.push(relativePath);
      }
    }
    if (missing.length) {
      throw new Error(`Production build is missing required files: ${missing.join(', ')}`);
    }
    for (const relativePath of forbiddenBuildOutput) {
      try {
        await stat(resolve(output, relativePath));
        throw new Error(`${relativePath} must not be part of the production build: index.html is the only entry.`);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  },
};

export default defineConfig({
  plugins: [vue(), serveLegacyRuntime, copyLegacyRuntime, verifyProductionOutput],
  // Only the Vue entry is optimised. Scanning legacy.html/standalone.html makes
  // Vite try to resolve their bare `three` import-map specifiers without a
  // package.json dependency, which fails the dependency scan in dev.
  optimizeDeps: { entries: ['index.html'] },
  test: { environment: 'jsdom', restoreMocks: true, clearMocks: true },
});
