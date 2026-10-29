import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(async () => {
  await import('../assets/i18n/site.js');
});

describe('site localization dictionary', () => {
  it('provides the same translation keys in Chinese and English', () => {
    const dictionaries = window.Aloop.i18n.dict;
    const zhKeys = Object.keys(dictionaries.zh).sort();
    const enKeys = Object.keys(dictionaries.en).sort();
    expect(zhKeys.length).toBeGreaterThan(0);
    expect(zhKeys).toEqual(enKeys);
  });
});
