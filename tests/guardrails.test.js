import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

// Regression guard: an automated edit once replaced these with older versions.
describe('protected features stay in place', () => {
  it('keeps the shell dropdown panels (experiments + products)', () => {
    const app = read('src/App.vue');
    for (const marker of ['class="quick-menu glass-panel"', 'class="products-menu glass-panel"', 'class="menu-soon"', 'products-menu-mark', 'data-shell-experiment="believe"']) {
      expect(app, marker).toContain(marker);
    }
    // The panels are styled by the shared stylesheet, not a shell-only copy.
    expect(read('src/main.js')).toContain('../assets/css/topbar.css');
    expect(read('assets/css/topbar.css')).toContain('.products-menu-item');
  });

  it('keeps the Smart Brain atlas wired into the legacy runtime and router', () => {
    const html = read('legacy.html');
    for (const file of ['store', 'cards', 'data', 'assets', 'scene', 'sidebar']) {
      expect(html, file).toContain(`assets/js/smartbrain/atlas/${file}.js`);
      expect(existsSync(join(ROOT, `assets/js/smartbrain/atlas/${file}.js`)), file).toBe(true);
    }
    expect(read('assets/js/core/router.js')).toContain('"atlas"');
    expect(existsSync(join(ROOT, 'assets/models/atlas/brain.glb'))).toBe(true);
    expect(read('assets/js/smartbrain/learn.js')).toContain('Aloop.atlas');
  });

  it('keeps the embedded 3D model viewer on the Smart Brain overview', () => {
    const html = read('legacy.html');
    expect(html).toContain('assets/js/smartbrain/model-viewer.js');
    expect(html.indexOf('model-viewer.js')).toBeLessThan(html.indexOf('smartbrain/learn.js'));
    const learn = read('assets/js/smartbrain/learn.js');
    expect(learn).toContain('id="sbModelStage"');
    expect(learn).toContain('Aloop.smartbrainModel?.mount()');
    expect(learn).toContain('Aloop.smartbrainModel?.destroy()');
    expect(read('assets/js/smartbrain/model-viewer.js')).toContain('Aloop.smartbrainModel');
  });
});
