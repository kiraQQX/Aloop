import { describe, expect, it, vi } from 'vitest';
import { BCI_STATUS, MockBciAdapter, SIGNAL_SOURCE, createBciAdapter, describeProvenance, registerBciAdapter } from '../src/lib/spark/bciAdapter';
import { COUNTDOWN_SECONDS, VoiceCapture, createCountdown, detectInputMode, getSpeechSupport, hasCaptureContent, normalizeFragments, readReferenceImage, validateReferenceImage } from '../src/lib/spark/captureService';
import { DemoGenerationAdapter, GenerationError, RemoteGenerationAdapter, buildGenerationInput, createGenerationAdapter } from '../src/lib/spark/generationAdapter';
import { ideaToRow, rowToIdea } from '../src/lib/spark/ideaMapper';
import { transition } from '../src/features/spark/sparkStore';
import { PHASE_TARGETS, SparkField } from '../src/features/spark/sparkField';

describe('Spark capture state machine', () => {
  it('walks idle → guide → capture → reconstructing → result', () => {
    let phase = 'idle';
    for (const [event, expected] of [['START', 'guide'], ['BEGIN', 'capture'], ['SUBMIT', 'reconstructing'], ['DONE', 'result']]) {
      phase = transition(phase, event);
      expect(phase).toBe(expected);
    }
  });

  it('allows cancelling, failing back to capture, and regenerating from a result', () => {
    expect(transition('guide', 'CANCEL')).toBe('idle');
    expect(transition('capture', 'CANCEL')).toBe('idle');
    expect(transition('reconstructing', 'FAIL')).toBe('capture');
    expect(transition('reconstructing', 'CANCEL')).toBe('capture');
    expect(transition('reconstructing', 'RESTORE_RESULT')).toBe('result');
    expect(transition('result', 'REGENERATE')).toBe('reconstructing');
    expect(transition('result', 'EDIT')).toBe('capture');
    expect(transition('result', 'NEW')).toBe('idle');
  });

  it('rejects impossible transitions', () => {
    expect(transition('idle', 'SUBMIT')).toBeNull();
    expect(transition('idle', 'DONE')).toBeNull();
    expect(transition('result', 'SUBMIT')).toBeNull();
    expect(transition('nowhere', 'START')).toBeNull();
  });
});

describe('Mock BCI adapter is honest about being a simulation', () => {
  it('reports simulated status and never claims a real device', async () => {
    const adapter = createBciAdapter('mock', { intervalMs: 0 });
    expect(adapter.isSimulated).toBe(true);
    expect(adapter.getStatus()).toBe(BCI_STATUS.DISCONNECTED);
    const check = await adapter.checkDevice();
    expect(check.simulated).toBe(true);
    expect(check.device).toBeNull();
    expect(adapter.getSignalQuality()).toEqual({ level: 'simulated', label: 'Simulated — no real measurement', simulated: true });
  });

  it('moves through connect → stream → stop → disconnect', async () => {
    const adapter = new MockBciAdapter({ intervalMs: 0 });
    await adapter.connect();
    expect(adapter.getStatus()).toBe(BCI_STATUS.CONNECTED);
    await adapter.start();
    expect(adapter.getStatus()).toBe(BCI_STATUS.STREAMING);
    await adapter.stop();
    expect(adapter.getStatus()).toBe(BCI_STATUS.CONNECTED);
    await adapter.disconnect();
    expect(adapter.getStatus()).toBe(BCI_STATUS.DISCONNECTED);
  });

  it('refuses to start before connecting', async () => {
    const adapter = new MockBciAdapter({ intervalMs: 0 });
    await expect(adapter.start()).rejects.toThrow(/Connect/);
  });

  it('surfaces a connection failure as an error state', async () => {
    const adapter = new MockBciAdapter({ intervalMs: 0, failConnect: true });
    await expect(adapter.connect()).rejects.toThrow();
    expect(adapter.getStatus()).toBe(BCI_STATUS.ERROR);
  });

  it('emits only a bounded visual drive, tagged simulated, with no EEG-like fields', async () => {
    const adapter = new MockBciAdapter({ intervalMs: 0 });
    const frames = [];
    const off = adapter.subscribe((frame) => { if (frame.type !== 'status') frames.push(frame); });
    await adapter.connect();
    await adapter.start();
    for (let i = 0; i < 50; i += 1) adapter.emitFrame(0.1);
    off();
    expect(frames).toHaveLength(50);
    for (const frame of frames) {
      expect(frame.simulated).toBe(true);
      expect(frame.source).toBe(SIGNAL_SOURCE.SIMULATED);
      expect(frame.drive).toBeGreaterThanOrEqual(0);
      expect(frame.drive).toBeLessThanOrEqual(1);
      expect(Object.keys(frame).sort()).toEqual(['drive', 'simulated', 'source', 't']);
    }
  });

  it('streams on its interval and stops cleanly', async () => {
    let tick = null;
    const setIntervalFn = vi.fn((fn) => { tick = fn; return 7; });
    const clearIntervalFn = vi.fn();
    const adapter = new MockBciAdapter({ intervalMs: 100, setIntervalFn, clearIntervalFn });
    const seen = [];
    adapter.subscribe((frame) => { if (frame.type !== 'status') seen.push(frame); });
    await adapter.connect();
    await adapter.start();
    tick();
    tick();
    expect(seen).toHaveLength(2);
    await adapter.stop();
    expect(clearIntervalFn).toHaveBeenCalledWith(7);
  });

  it('lets a real adapter be registered without touching callers, and labels provenance', () => {
    registerBciAdapter('fake-eeg', () => new MockBciAdapter({ intervalMs: 0 }));
    expect(createBciAdapter('fake-eeg')).toBeInstanceOf(MockBciAdapter);
    expect(() => createBciAdapter('missing')).toThrow(/Unknown/);
    expect(describeProvenance('demo', 'en')).toMatch(/not AI generated/);
    expect(describeProvenance('ai', 'en')).toBe('AI generated');
    expect(describeProvenance('device', 'zh')).toBe('设备数据');
  });
});

describe('capture helpers', () => {
  it('runs a countdown to completion and can be cancelled', () => {
    let tick = null;
    const ticks = [];
    const done = vi.fn();
    const clear = vi.fn();
    const countdown = createCountdown({ seconds: 3, onTick: (n) => ticks.push(n), onDone: done, setIntervalFn: (fn) => { tick = fn; return 1; }, clearIntervalFn: clear });
    countdown.start();
    tick(); tick(); tick();
    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalled();
    expect(COUNTDOWN_SECONDS).toBeGreaterThan(0);

    const cancelled = vi.fn();
    const second = createCountdown({ seconds: 5, onDone: cancelled, setIntervalFn: () => 2, clearIntervalFn: clear });
    second.start();
    second.cancel();
    expect(second.running).toBe(false);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('keeps fragments optional and trims what is given', () => {
    expect(normalizeFragments({})).toEqual({});
    expect(normalizeFragments({ subject: '  a   door ', color: '', bogus: 'x' })).toEqual({ subject: 'a door' });
    expect(hasCaptureContent({})).toBe(false);
    expect(hasCaptureContent({ fragments: { color: 'blue' } })).toBe(true);
    expect(hasCaptureContent({ text: '  ' })).toBe(false);
  });

  it('detects the input mode from the channels used', () => {
    expect(detectInputMode({ text: 'x' })).toBe('imagery');
    expect(detectInputMode({ text: 'x', voiceUsed: true })).toBe('voice');
    expect(detectInputMode({ fragments: { subject: 'a' } })).toBe('fragments');
    expect(detectInputMode({ image: {} })).toBe('image');
    expect(detectInputMode({ text: 'x', fragments: { subject: 'a' } })).toBe('mixed');
  });

  it('validates reference images', async () => {
    expect(validateReferenceImage({ type: 'application/pdf', size: 10 }).code).toBe('bad_type');
    expect(validateReferenceImage({ type: 'image/png', size: 4 * 1024 * 1024 }).code).toBe('too_large');
    expect(validateReferenceImage({ type: 'image/png', size: 100 })).toBeNull();
    await expect(readReferenceImage({ type: 'text/plain', size: 1 })).rejects.toMatchObject({ code: 'bad_type' });
  });
});

describe('voice capture', () => {
  it('reports unsupported browsers instead of failing silently', () => {
    const onError = vi.fn();
    const voice = new VoiceCapture({ win: { navigator: {} }, onError });
    voice.start();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].code).toBe('unsupported');
    expect(voice.state).toBe('error');
    expect(getSpeechSupport({ navigator: {} }).recognition).toBe(false);
  });

  it('never starts recording until start() is called, and maps permission denial', () => {
    let instance;
    class FakeRecognition {
      constructor() { instance = this; this.started = false; }
      start() { this.started = true; }
      stop() {}
      abort() {}
    }
    const onError = vi.fn();
    const win = { SpeechRecognition: FakeRecognition, navigator: {} };
    const voice = new VoiceCapture({ win, onError });
    expect(instance).toBeUndefined();
    voice.start();
    expect(instance.started).toBe(true);
    expect(voice.state).toBe('listening');
    instance.onerror({ error: 'not-allowed' });
    expect(onError.mock.calls[0][0].code).toBe('permission_denied');
    expect(voice.state).toBe('error');
  });

  it('streams interim and final transcripts', () => {
    let instance;
    class FakeRecognition {
      constructor() { instance = this; }
      start() {}
      stop() {}
      abort() {}
    }
    const transcripts = [];
    const voice = new VoiceCapture({ win: { SpeechRecognition: FakeRecognition, navigator: {} }, onTranscript: (text, final) => transcripts.push([text, final]) });
    voice.start();
    instance.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'blue corridor' }], { isFinal: true })] });
    expect(transcripts.at(-1)).toEqual(['blue corridor', true]);
  });
});

describe('generation adapters', () => {
  const input = () => buildGenerationInput({ text: 'a blue corridor at dusk', fragments: { color: 'blue and gold light', motion: 'slow turning' }, language: 'en' });

  it('builds a structured input from every cue', () => {
    const built = input();
    expect(built.fragments).toEqual({ color: 'blue and gold light', motion: 'slow turning' });
    expect(built.prompt).toContain('a blue corridor at dusk');
    expect(built.prompt).toContain('Style: Luminous field');
    expect(built.keywords.length).toBeGreaterThan(0);
  });

  it('falls back to the labelled demo adapter when no endpoint is configured', async () => {
    const adapter = createGenerationAdapter({ endpoint: '', demoDelayMs: 0 });
    expect(adapter.isDemo).toBe(true);
    const result = await adapter.generate(input());
    expect(result.provenance).toBe('demo');
    expect(result.imageSvg).toContain('<svg');
    expect(result.imageUrl).toBeNull();
    expect(result.prompt).toContain('blue corridor');
  });

  it('is deterministic for the same cues and different for different cues', async () => {
    const adapter = new DemoGenerationAdapter({ delayMs: 0 });
    const a = await adapter.generate(input());
    const b = await adapter.generate(input());
    const c = await adapter.generate(buildGenerationInput({ text: 'a red staircase', language: 'en' }));
    expect(a.imageSvg).toBe(b.imageSvg);
    expect(a.imageSvg).not.toBe(c.imageSvg);
  });

  it('rejects empty input and supports cancellation', async () => {
    const adapter = new DemoGenerationAdapter({ delayMs: 50 });
    await expect(adapter.generate(buildGenerationInput({}))).rejects.toMatchObject({ code: 'empty_input' });
    const controller = new AbortController();
    const pending = adapter.generate(input(), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
  });

  it('calls a configured server endpoint without ever sending a secret', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ imageUrl: 'https://cdn.example.com/a.png', description: 'd', tags: ['x'] }) }));
    const adapter = new RemoteGenerationAdapter({ endpoint: 'https://api.example.com/spark', fetchImpl, getAccessToken: async () => 'user-jwt' });
    const result = await adapter.generate(input());
    expect(result.provenance).toBe('ai');
    expect(result.imageUrl).toBe('https://cdn.example.com/a.png');
    const [, options] = fetchImpl.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer user-jwt');
    expect(JSON.parse(options.body)).not.toHaveProperty('apiKey');
  });

  it('turns service failures into real errors', async () => {
    const make = (fetchImpl) => new RemoteGenerationAdapter({ endpoint: 'https://api.example.com/spark', fetchImpl });
    await expect(make(async () => ({ ok: false, status: 502 })).generate(input())).rejects.toMatchObject({ code: 'http_502' });
    await expect(make(async () => { throw new Error('offline'); }).generate(input())).rejects.toMatchObject({ code: 'network' });
    await expect(make(async () => ({ ok: true, json: async () => ({ imageUrl: 'http://insecure/x.png' }) })).generate(input())).rejects.toMatchObject({ code: 'bad_response' });
    expect(() => new RemoteGenerationAdapter({})).toThrow(GenerationError);
  });
});

describe('idea ↔ row mapping', () => {
  it('round-trips an idea without losing fields', () => {
    const idea = { id: 'i1', title: 'Corridor', rawInput: 'blue', inputMode: 'voice', sensoryProfile: { visual: 5 }, visualDescription: 'desc', generationPrompt: 'p', tags: ['a'], assetPath: 'u/i1.svg', provenance: 'demo', composition: 'c', palette: ['#fff'], style: 'ink', fragments: { color: 'blue' }, createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T01:00:00Z' };
    const row = ideaToRow(idea, 'user-1');
    expect(row.user_id).toBe('user-1');
    expect(row.input_mode).toBe('voice');
    const back = rowToIdea(row);
    expect(back).toMatchObject({ id: 'i1', title: 'Corridor', inputMode: 'voice', tags: ['a'], style: 'ink', syncState: 'synced', inCloud: true });
  });

  it('coerces an unknown input mode to mixed', () => {
    expect(ideaToRow({ id: 'x', inputMode: 'telepathy' }, 'u').input_mode).toBe('mixed');
  });
});

describe('neural field', () => {
  it('builds a bounded node/edge set and steps without a canvas', () => {
    const field = new SparkField({ count: 120, seed: 3 });
    field.resize(800, 500);
    const stats = field.getStats();
    expect(stats.nodes).toBe(120);
    expect(stats.edges).toBeGreaterThan(0);
    field.setPhase('capture');
    for (let i = 0; i < 120; i += 1) field.step(1 / 60);
    expect(field.state.converge).toBeGreaterThan(0.5);
    field.setPhase('reconstructing');
    for (let i = 0; i < 200; i += 1) field.step(1 / 60);
    expect(field.state.expand).toBeGreaterThan(0.5);
  });

  it('snaps to a phase instantly for static / reduced-motion frames', () => {
    const field = new SparkField({ count: 60 });
    field.setPhase('result', { instant: true });
    expect(field.state.dim).toBe(PHASE_TARGETS.result.dim);
  });

  it('draws through a 2D-context-like object', () => {
    const calls = [];
    const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, {
      get: (_, name) => (name === 'createRadialGradient' ? () => gradient : (...args) => { calls.push(name); return args; }),
      set: () => true,
    });
    const field = new SparkField({ count: 80 });
    field.resize(640, 400);
    field.ripple(100, 100);
    field.draw(ctx);
    expect(calls).toContain('clearRect');
    expect(calls).toContain('stroke');
  });
});
