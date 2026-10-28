import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const serveAboutPageAlias = {
  name: 'serve-about-page-alias',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const [pathname, query] = (request.url || '').split('?');
      let decodedPath = pathname;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        // Leave malformed URLs to Vite's normal request handling.
      }
      if (decodedPath === '/说明.html') {
        request.url = `/璇存槑.html${query ? `?${query}` : ''}`;
      }
      next();
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
  plugins: [vue(), copyLegacyRuntime],
  test: { environment: 'jsdom', restoreMocks: true, clearMocks: true },
});
