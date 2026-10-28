import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const projectRoot = dirname(fileURLToPath(import.meta.url));
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
      const [pathname, query] = (request.url || '').split('?');
      let decodedPath = pathname;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        // Leave malformed URLs to Vite's normal request handling.
      }

      if (decodedPath === '/说明.html') {
        request.url = `/璇存槑.html${query ? `?${query}` : ''}`;
        next();
        return;
      }

      if (!decodedPath.startsWith('/assets/') && !decodedPath.startsWith('/experiments/')) {
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

const copyLegacyRuntime = {
  name: 'copy-legacy-runtime',
  apply: 'build',
  async closeBundle() {
    const output = resolve(projectRoot, 'dist');
    await mkdir(output, { recursive: true });
    await cp(resolve(projectRoot, 'legacy.html'), resolve(output, 'legacy.html'));
    await cp(resolve(projectRoot, 'assets'), resolve(output, 'assets'), { recursive: true });
    await cp(resolve(projectRoot, 'experiments'), resolve(output, 'experiments'), { recursive: true });
    await cp(resolve(projectRoot, '璇存槑.html'), resolve(output, '说明.html'));
  },
};

export default defineConfig({
  plugins: [vue(), serveLegacyRuntime, copyLegacyRuntime],
  test: { environment: 'jsdom', restoreMocks: true, clearMocks: true },
});
