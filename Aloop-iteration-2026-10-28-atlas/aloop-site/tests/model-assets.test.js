import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const MODEL_DIR = 'assets/models/atlas';

describe('self-hosted brain model', () => {
  it('ships the GLB, manifest and Draco decoder with the site', () => {
    for (const file of [
      `${MODEL_DIR}/brain.glb`,
      `${MODEL_DIR}/manifest.json`,
      `${MODEL_DIR}/draco/draco_decoder.js`,
      `${MODEL_DIR}/draco/draco_decoder.wasm`,
      `${MODEL_DIR}/draco/draco_wasm_wrapper.js`,
      `${MODEL_DIR}/ATTRIBUTION.md`,
    ]) {
      const path = join(ROOT, file);
      expect(existsSync(path), `missing ${file}`).toBe(true);
      expect(statSync(path).size, `empty ${file}`).toBeGreaterThan(1024);
    }
  });

  it('keeps the CC BY-SA attribution next to the redistributed model', () => {
    const attribution = read(`${MODEL_DIR}/ATTRIBUTION.md`);
    expect(attribution).toContain('CC BY-SA 4.0');
    expect(attribution).toContain('itayinbarr/brainproject');
    expect(attribution).toContain('Z-Anatomy');
  });

  it('never falls back to the remote model hosts that reset in mainland China', () => {
    for (const file of [
      'assets/js/gl/brain-surface.js',
      'assets/js/gl/particle-cortex.js',
      'assets/js/smartbrain/atlas/assets.js',
      'standalone.html',
    ]) {
      const source = read(file);
      const code = source.replace(/^\s*\/\/.*$/gm, '');
      expect(code, `${file} still fetches the model from raw.githubusercontent.com`).not.toContain(
        'raw.githubusercontent.com',
      );
      expect(code, `${file} still fetches Draco from gstatic.com`).not.toContain('gstatic.com/draco');
    }
  });
});
