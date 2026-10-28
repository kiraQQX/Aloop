import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

describe('legacy shell regression checks', () => {
  const html = read('legacy.html');

  it('resolves every local stylesheet and script referenced by the legacy shell', () => {
    const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((ref) => ref.startsWith('assets/') || ref.startsWith('experiments/'));
    expect(refs.length).toBeGreaterThan(20);
    const missing = refs.filter((ref) => !existsSync(join(ROOT, ref)));
    expect(missing, `Missing local shell assets: ${missing.join(', ')}`).toEqual([]);
  });

  it('preserves the intentional runtime script dependency order', () => {
    const ordered = [
      'assets/js/core/store.js',
      'assets/i18n/site.js',
      'assets/js/registry.js',
      'experiments/believe/manifest.js',
      'assets/js/core/router.js',
    ].map((path) => html.indexOf(`src="${path}"`));
    expect(ordered.every((index) => index >= 0)).toBe(true);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
  });

  it('retains the Vue shell and legacy entry as separate layers', () => {
    const index = read('index.html');
    const app = read('src/App.vue');
    expect(index).toContain('id="app"');
    expect(index).toContain('/src/main.js');
    expect(app).toContain('src="./legacy.html"');
    expect(html).toContain('id="experiment-root"');
  });
});

describe('EasySci catalogue integrity', () => {
  it('contains unique, structured HTTPS resources with at least 50 entries per category', () => {
    const source = read('assets/js/easysci/data.js');
    const match = source.match(/const C=(\{[\s\S]*?\});\s*const R=(\[[\s\S]*?\]);\s*A\.easysciData/);
    expect(match, 'Could not parse EasySci category and resource declarations').not.toBeNull();
    const categories = JSON.parse(match[1]);
    const resources = JSON.parse(match[2]);
    expect(resources.length).toBeGreaterThanOrEqual(400);
    expect(new Set(resources.map((item) => item.id)).size).toBe(resources.length);
    expect(new Set(resources.map((item) => item.officialUrl)).size).toBe(resources.length);
    expect(resources.every((item) => item.officialUrl.startsWith('https://'))).toBe(true);
    expect(Object.keys(categories).length).toBeGreaterThanOrEqual(8);
    for (const category of Object.keys(categories)) {
      expect(resources.filter((item) => item.category === category).length, category).toBeGreaterThanOrEqual(50);
    }
    expect(resources.every((item) => item.verificationStatus === 'needs-manual-confirmation' && item.lastVerifiedAt === null)).toBe(true);
    const required = ['name', 'category', 'officialUrl', 'accessModels', 'description', 'details', 'useCases', 'strengths', 'limitations', 'signIn', 'freeTier', 'licenseNote', 'lastVerifiedAt'];
    expect(resources.every((item) => required.every((field) => Object.hasOwn(item, field)))).toBe(true);
    expect(resources.every((item) => Object.hasOwn(categories, item.category))).toBe(true);
  });
});

describe('routing, localization, and safety regressions', () => {
  it('keeps product routes and the bilingual navigation contract', () => {
    const router = read('assets/js/core/router.js');
    const registry = read('assets/js/registry.js');
    const i18n = read('assets/i18n/site.js');
    const html = read('legacy.html');
    expect(router).toContain('parts[0] === "easysci"');
    expect(registry).toContain('#/smart-brain');
    expect(html).toContain('id="productsToggle"');
    expect(html).toContain('id="productsMenu"');
    for (const key of ['nav.experiments', 'nav.products', 'nav.about']) {
      expect(i18n).toContain(`"${key}":`);
    }
    expect(i18n).toContain('"nav.experiments": "实验"');
    expect(i18n).toContain('"nav.experiments": "Experiments"');
  });

  it('keeps outbound links protected and does not load heavy clone bundles', () => {
    const html = read('legacy.html');
    const easysci = read('assets/js/easysci/easysci.js');
    expect(easysci).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain('webclone-local-loader.js');
    expect(html).not.toContain('GSAP');
    expect(html).not.toContain('ASScroll');
  });
});
