// Visual reconstruction adapter.
//
// Two implementations behind one contract:
//  * RemoteGenerationAdapter — POSTs a structured request to a server-side
//    endpoint (VITE_SPARK_GENERATION_ENDPOINT). The browser never holds a
//    third-party API secret; the endpoint owns credentials, quotas and content
//    policy. No endpoint is assumed to exist.
//  * DemoGenerationAdapter — used when no endpoint is configured. It renders a
//    deterministic, locally generated abstract visual and labels the result
//    `provenance: 'demo'`. It is NOT AI generation and the UI says so.

import { FRAGMENT_KEYS, normalizeFragments, normalizeText } from './captureService';

export class GenerationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
  }
}

export const STYLE_PRESETS = Object.freeze([
  { id: 'luminous', en: 'Luminous field', zh: '发光场域' },
  { id: 'ink', en: 'Ink & mist', zh: '水墨烟雾' },
  { id: 'architectural', en: 'Architectural', zh: '空间建筑' },
  { id: 'organic', en: 'Organic forms', zh: '有机形态' },
]);

const FRAGMENT_LABELS = {
  subject: { en: 'Subject', zh: '主体' },
  color: { en: 'Colour & light', zh: '颜色与光线' },
  space: { en: 'Space', zh: '空间' },
  motion: { en: 'Motion', zh: '运动' },
  emotion: { en: 'Feeling', zh: '情绪' },
  other: { en: 'Other', zh: '其他' },
};

export function fragmentLabel(key, language = 'en') {
  return (FRAGMENT_LABELS[key] || { en: key, zh: key })[language === 'zh' ? 'zh' : 'en'];
}

const COLOR_WORDS = [
  [/红|red|crimson|scarlet/i, '#c8434f'],
  [/橙|orange|amber/i, '#e08a3c'],
  [/黄|金|yellow|gold/i, '#F2CC4D'],
  [/绿|green|emerald/i, '#3f9f7a'],
  [/青|cyan|teal|turquoise/i, '#5AB7BD'],
  [/蓝|blue|azure|indigo/i, '#477EAE'],
  [/紫|purple|violet/i, '#8a6bbf'],
  [/粉|pink|rose/i, '#d77aa5'],
  [/白|white|silver/i, '#dfe9f3'],
  [/黑|dark|black/i, '#1b2b3d'],
];

function hash32(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function extractKeywords({ text = '', fragments = {} } = {}, limit = 8) {
  const source = [text, ...FRAGMENT_KEYS.map((key) => fragments[key] || '')].join(' ');
  const parts = source
    .split(/[\s,，。.、;；:：!！?？/\\|()（）"“”'‘’\n\r]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 24);
  const seen = new Set();
  const out = [];
  for (const word of parts) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

/** Collects every capture channel into the structured input a generator needs. */
export function buildGenerationInput({ text = '', fragments = {}, profile = null, style = 'luminous', hasReferenceImage = false, mode = 'imagery', language = 'zh' } = {}) {
  const cleanFragments = normalizeFragments(fragments);
  const cleanText = normalizeText(text);
  const input = {
    text: cleanText,
    fragments: cleanFragments,
    keywords: extractKeywords({ text: cleanText, fragments: cleanFragments }),
    style: STYLE_PRESETS.some((preset) => preset.id === style) ? style : 'luminous',
    hasReferenceImage: Boolean(hasReferenceImage),
    mode,
    language: language === 'en' ? 'en' : 'zh',
    imageryProfile: profile?.dims ? { ...profile.dims } : null,
  };
  input.prompt = buildPrompt(input);
  return input;
}

export function buildPrompt(input) {
  const lines = [];
  if (input.text) lines.push(input.text);
  for (const key of FRAGMENT_KEYS) {
    if (input.fragments?.[key]) lines.push(`${fragmentLabel(key, 'en')}: ${input.fragments[key]}`);
  }
  const style = STYLE_PRESETS.find((preset) => preset.id === input.style) || STYLE_PRESETS[0];
  lines.push(`Style: ${style.en}`);
  if (input.imageryProfile) {
    const strong = Object.entries(input.imageryProfile).filter(([, value]) => value >= 4).map(([name]) => name);
    if (strong.length) lines.push(`Emphasise sensory dimensions: ${strong.join(', ')}`);
  }
  if (input.hasReferenceImage) lines.push('A reference image was supplied for composition and material.');
  return lines.join('\n');
}

function paletteFrom(input, rand) {
  const text = `${input.text} ${input.fragments.color || ''}`;
  const colors = COLOR_WORDS.filter(([pattern]) => pattern.test(text)).map(([, hex]) => hex);
  const base = ['#23466D', '#477EAE', '#5AB7BD'];
  const merged = [...colors, ...base].slice(0, 4);
  if (rand() > 0.55 && !merged.includes('#F2CC4D')) merged[merged.length - 1] = '#F2CC4D';
  return merged;
}

function composeSvg(input, palette, seed) {
  const rand = rng(seed);
  const w = 960;
  const h = 640;
  const blobs = [];
  const count = 7 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i += 1) {
    const x = 120 + rand() * (w - 240);
    const y = 90 + rand() * (h - 180);
    const r = 60 + rand() * 170;
    const color = palette[i % palette.length];
    blobs.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.1 + rand() * 0.22).toFixed(2)}"/>`);
  }
  const arcs = [];
  for (let i = 0; i < 5; i += 1) {
    const y = 120 + rand() * 400;
    const amp = 20 + rand() * 70;
    const d = `M0 ${y.toFixed(1)} C ${w * 0.25} ${(y - amp).toFixed(1)}, ${w * 0.6} ${(y + amp).toFixed(1)}, ${w} ${(y - amp / 2).toFixed(1)}`;
    arcs.push(`<path d="${d}" stroke="${palette[(i + 1) % palette.length]}" stroke-width="${(1 + rand() * 1.6).toFixed(1)}" fill="none" opacity="${(0.25 + rand() * 0.4).toFixed(2)}"/>`);
  }
  const dots = [];
  for (let i = 0; i < 46; i += 1) {
    dots.push(`<circle cx="${(rand() * w).toFixed(1)}" cy="${(rand() * h).toFixed(1)}" r="${(1 + rand() * 2.4).toFixed(1)}" fill="#e8f0f8" opacity="${(0.25 + rand() * 0.5).toFixed(2)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img"><defs><radialGradient id="g" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="${palette[0]}" stop-opacity=".55"/><stop offset="1" stop-color="#07121f"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${blobs.join('')}${arcs.join('')}${dots.join('')}</svg>`;
}

export function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function describeScene(input, palette) {
  const zh = input.language === 'zh';
  const bits = [];
  if (input.fragments.subject) bits.push(zh ? `主体：${input.fragments.subject}` : `Subject: ${input.fragments.subject}`);
  if (input.fragments.space) bits.push(zh ? `空间：${input.fragments.space}` : `Space: ${input.fragments.space}`);
  if (input.fragments.motion) bits.push(zh ? `运动：${input.fragments.motion}` : `Motion: ${input.fragments.motion}`);
  if (input.fragments.emotion) bits.push(zh ? `情绪：${input.fragments.emotion}` : `Feeling: ${input.fragments.emotion}`);
  if (!bits.length && input.text) bits.push(input.text.slice(0, 140));
  if (!bits.length) bits.push(zh ? '一个尚未命名的意象' : 'An as-yet unnamed image');
  return {
    description: bits.join(zh ? '；' : '; '),
    composition: zh
      ? `以中心光场为视觉重心，色彩取自 ${palette.join(' / ')}。这是演示渲染，仅依据你的文字线索排布。`
      : `Centre-weighted light field, palette ${palette.join(' / ')}. Demo render arranged only from your written cues.`,
  };
}

const delay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new GenerationError('aborted', 'Generation was cancelled.')); return; }
  const timer = setTimeout(() => { signal?.removeEventListener?.('abort', onAbort); resolve(); }, ms);
  function onAbort() { clearTimeout(timer); reject(new GenerationError('aborted', 'Generation was cancelled.')); }
  signal?.addEventListener?.('abort', onAbort, { once: true });
});

export class DemoGenerationAdapter {
  constructor({ delayMs = 1800 } = {}) {
    this.delayMs = delayMs;
  }

  get id() { return 'demo'; }
  get isDemo() { return true; }

  async generate(input, { signal } = {}) {
    if (!input || (!input.text && !Object.keys(input.fragments || {}).length && !input.hasReferenceImage)) {
      throw new GenerationError('empty_input', 'Add at least one cue before generating.');
    }
    await delay(this.delayMs, signal);
    const seed = hash32(`${input.prompt}|${input.style}`);
    const palette = paletteFrom(input, rng(seed));
    const svg = composeSvg(input, palette, seed);
    const scene = describeScene(input, palette);
    return {
      provenance: 'demo',
      adapter: 'demo',
      imageSvg: svg,
      imageUrl: null,
      description: scene.description,
      composition: scene.composition,
      palette,
      tags: input.keywords.slice(0, 8),
      prompt: input.prompt,
      style: input.style,
      generatedAt: new Date().toISOString(),
    };
  }
}

export class RemoteGenerationAdapter {
  constructor({ endpoint, fetchImpl, getAccessToken, timeoutMs = 60000 } = {}) {
    if (!endpoint) throw new GenerationError('not_configured', 'No generation endpoint configured.');
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl || ((...args) => fetch(...args));
    this.getAccessToken = getAccessToken || (async () => null);
    this.timeoutMs = timeoutMs;
  }

  get id() { return 'remote'; }
  get isDemo() { return false; }

  async generate(input, { signal } = {}) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener?.('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const token = await this.getAccessToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      let response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: input.prompt, style: input.style, keywords: input.keywords, language: input.language }),
          signal: controller.signal,
        });
      } catch (error) {
        if (signal?.aborted) throw new GenerationError('aborted', 'Generation was cancelled.');
        if (controller.signal.aborted) throw new GenerationError('timeout', 'The generation service took too long to respond.');
        throw new GenerationError('network', error?.message || 'Could not reach the generation service.');
      }
      if (!response.ok) throw new GenerationError(`http_${response.status}`, `The generation service returned HTTP ${response.status}.`);
      let body;
      try { body = await response.json(); } catch { throw new GenerationError('bad_response', 'The generation service returned an unreadable response.'); }
      if (!body || typeof body !== 'object' || typeof body.imageUrl !== 'string' || !/^https:\/\//i.test(body.imageUrl)) {
        throw new GenerationError('bad_response', 'The generation service did not return an https image URL.');
      }
      return {
        provenance: 'ai',
        adapter: 'remote',
        imageSvg: null,
        imageUrl: body.imageUrl,
        description: String(body.description || input.text || '').slice(0, 1000),
        composition: String(body.composition || '').slice(0, 1000),
        palette: Array.isArray(body.palette) ? body.palette.filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 6) : [],
        tags: Array.isArray(body.tags) ? body.tags.map(String).slice(0, 12) : input.keywords,
        prompt: String(body.prompt || input.prompt),
        style: input.style,
        generatedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }
  }
}

export function getGenerationEndpoint() {
  const value = import.meta.env?.VITE_SPARK_GENERATION_ENDPOINT;
  return typeof value === 'string' && /^https:\/\//i.test(value) ? value : '';
}

export function createGenerationAdapter({ endpoint = getGenerationEndpoint(), getAccessToken, fetchImpl, demoDelayMs } = {}) {
  if (endpoint) return new RemoteGenerationAdapter({ endpoint, getAccessToken, fetchImpl });
  return new DemoGenerationAdapter({ delayMs: demoDelayMs });
}
