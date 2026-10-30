import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

// The release contract: index.html is the only production entry, the legacy H5
// runtime is served as static documents, and standalone.html stays a
// development-only reference that never becomes a second homepage.
describe('single production entry', () => {
  it('mounts the Vue application from index.html and nothing else', () => {
    const index = read('index.html');
    expect(index).toContain('<div id="app"></div>');
    expect(index).toContain('src="/src/main.js"');
    expect(index).not.toContain('standalone.html');
    expect(index).not.toContain('legacy.html');
  });

  it('keeps the legacy documents classic H5 pages without a Vue mount point', () => {
    for (const file of ['legacy.html', '说明.html']) {
      const html = read(file);
      expect(html, `${file} must not become a second Vite entry`).not.toContain('/src/main.js');
      expect(html, `${file} must not link the historical single-file build`).not.toContain('standalone.html');
    }
  });

  it('never routes the Vue shell to standalone.html', () => {
    const app = read('src/App.vue');
    expect(app).not.toContain('standalone.html');
    expect(app).toContain('./legacy.html?embed=1');
  });

  it('serves standalone.html in development only and blocks it from the build', () => {
    const config = read('vite.config.js');
    expect(config).toContain("referenceDocuments = ['/standalone.html']");
    expect(config).toContain('X-Robots-Tag');
    expect(config).toContain("forbiddenBuildOutput = ['standalone.html']");
    expect(config).toContain('verify-production-output');
    // A production build must fail loudly when a required asset is missing.
    expect(config).toContain('Production build is missing required files');
  });

  it('does not scan the legacy import map while optimising dependencies', () => {
    const config = read('vite.config.js');
    expect(config).toContain("optimizeDeps: { entries: ['index.html'] }");
  });
});

describe('built output', () => {
  const dist = join(ROOT, 'dist');
  const built = existsSync(join(dist, 'index.html'));

  it('never ships standalone.html', () => {
    if (!built) return; // A clean checkout has no dist; the build guard covers it.
    expect(existsSync(join(dist, 'standalone.html'))).toBe(false);
  });

  it('ships the runtime documents, model and experiment assets', () => {
    if (!built) return;
    for (const file of [
      'index.html',
      'legacy.html',
      '说明.html',
      'assets/js/core/router.js',
      'assets/i18n/site.js',
      'assets/models/atlas/brain.glb',
      'assets/models/atlas/draco/draco_decoder.wasm',
      'experiments/believe/runtime.js',
    ]) {
      expect(existsSync(join(dist, file)), `dist is missing ${file}`).toBe(true);
    }
  });
});

describe('static asset paths', () => {
  const documents = ['legacy.html', '说明.html', 'index.html'];

  it('uses relative asset references that resolve after the Vite build', () => {
    for (const file of documents) {
      const html = read(file);
      const references = [...html.matchAll(/(?:href|src)="(?!data:|https?:|#|\/src\/|\.\/)([^"]+)"/g)].map((m) => m[1]);
      for (const reference of references) {
        const target = join(ROOT, reference);
        expect(existsSync(target), `${file} references missing asset ${reference}`).toBe(true);
      }
    }
  });

  it('keeps the Anatomical Atlas model and decoder paths relative to the document', () => {
    for (const file of [
      'assets/js/smartbrain/atlas/assets.js',
      'assets/js/gl/particle-cortex.js',
    ]) {
      const source = read(file);
      // Comments may mention the retired hosts; executable code must not use them.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(source).toContain('assets/models/atlas/');
      expect(code).not.toContain('raw.githubusercontent.com');
      expect(code).not.toContain('gstatic.com/draco');
    }
  });

  it('declares the Draco decoder files that the manifest loader requests', () => {
    const dracoFiles = readdirSync(join(ROOT, 'assets/models/atlas/draco'));
    expect(dracoFiles).toContain('draco_decoder.wasm');
    expect(dracoFiles).toContain('draco_wasm_wrapper.js');
    expect(statSync(join(ROOT, 'assets/models/atlas/draco/draco_decoder.wasm')).size).toBeGreaterThan(1024);
  });
});

describe('bilingual About page', () => {
  it('supports the embedded shell mode and an explicit language parameter', () => {
    const html = read('说明.html');
    expect(html).toContain("params.get('embed') === '1'");
    expect(html).toContain("params.get('lang')");
    expect(html).toContain('vue-embedded');
    expect(html).toContain('data-about-lang="en"');
    expect(html).toContain('class="lang-en"');
  });

  it('is rendered from the shell as an embedded, language-aware document', () => {
    const app = read('src/App.vue');
    expect(app).toContain('./说明.html?embed=1');
    expect(app).toContain('lang=${language.value}');
  });

  it('shares the language preference key with the legacy runtime', () => {
    const app = read('src/App.vue');
    const i18n = read('assets/i18n/site.js');
    expect(app).toContain("LANGUAGE_KEY = 'aloop_lang_v1'");
    expect(i18n).toContain('aloop_lang_v1');
  });
});

describe('documentation entry points', () => {
  it('documents the single production entry in the README', () => {
    const readme = read('README.md');
    expect(readme).toContain('index.html');
    expect(readme.toLowerCase()).toContain('standalone.html');
  });

  it('keeps the migration documents together under docs/', () => {
    for (const file of [
      'docs/MIGRATION_AUDIT.md',
      'docs/FEATURE_MIGRATION_MATRIX.md',
      'docs/TECHNICAL_REQUIREMENTS.md',
      'docs/ENGINEERING_PROGRESS.md',
      'docs/RELEASE_QA_REPORT.md',
    ]) {
      expect(existsSync(join(ROOT, file)), `missing ${file}`).toBe(true);
    }
  });
});

// Guard against accidental edits to unrelated product modules: the runtime
// documents must keep listing the same module graph.
describe('legacy runtime module graph', () => {
  it('keeps every script referenced by legacy.html on disk', () => {
    const html = read('legacy.html');
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(20);
    for (const script of scripts) {
      expect(existsSync(join(ROOT, script)), `legacy.html references missing script ${script}`).toBe(true);
    }
  });

  it('keeps every stylesheet referenced by legacy.html on disk', () => {
    const html = read('legacy.html');
    const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]);
    expect(styles.length).toBeGreaterThan(8);
    for (const style of styles) {
      expect(existsSync(join(ROOT, style)), `legacy.html references missing stylesheet ${style}`).toBe(true);
    }
  });
});
