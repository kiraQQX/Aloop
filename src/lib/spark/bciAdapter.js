// Brain-computer-interface adapter layer for Spark.
//
// Spark never talks to hardware directly. Everything goes through the
// BciAdapter contract below, so a real EEG integration later is one new class
// registered with `registerBciAdapter` — no UI rewrite.
//
// TRUTHFULNESS RULES (enforced by tests):
//  * The default MockBciAdapter is SIMULATED. Every frame it emits carries
//    `simulated: true` and `source: 'simulated'`.
//  * It never emits channel data, band powers, decoding accuracy, or decoded
//    imagery. The only number is `drive` (0..1), a purely visual animation
//    driver.
//  * A future device adapter must tag frames `source: 'device'`. Algorithmic
//    inference and AI generation are separate provenance levels and must not
//    be reported as device readings.

export const BCI_STATUS = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  STREAMING: 'streaming',
  ERROR: 'error',
});

export const SIGNAL_SOURCE = Object.freeze({
  SIMULATED: 'simulated',
  DEVICE: 'device',
});

export const SIMULATION_NOTICE = Object.freeze({
  en: { label: 'SIMULATED NEURAL SIGNAL', detail: 'Demo signal — not a real EEG recording.' },
  zh: { label: 'SIMULATED NEURAL SIGNAL', detail: '演示信号，不代表真实脑电采集' },
});

/**
 * Contract every adapter implements. Methods may be sync or async.
 * (Documented as a class so `instanceof`/duck-typing checks stay simple.)
 */
export class BciAdapter {
  get id() { throw new Error('BciAdapter.id not implemented'); }
  get isSimulated() { return false; }
  getStatus() { throw new Error('not implemented'); }
  checkDevice() { throw new Error('not implemented'); }
  connect() { throw new Error('not implemented'); }
  disconnect() { throw new Error('not implemented'); }
  subscribe(/* callback */) { throw new Error('not implemented'); }
  start() { throw new Error('not implemented'); }
  stop() { throw new Error('not implemented'); }
  calibrate(/* task */) { throw new Error('not implemented'); }
  getSignalQuality() { throw new Error('not implemented'); }
}

// Small seeded PRNG so simulated motion is reproducible in tests.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BciError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BciError';
    this.code = code;
  }
}

/**
 * Simulation-only adapter. Produces a smooth, bounded animation driver. It does
 * not model, mimic, or claim any real neural measurement.
 */
export class MockBciAdapter extends BciAdapter {
  constructor({ seed = 42, intervalMs = 100, setIntervalFn, clearIntervalFn, failConnect = false } = {}) {
    super();
    this._status = BCI_STATUS.DISCONNECTED;
    this._listeners = new Set();
    this._rand = mulberry32(seed);
    this._intervalMs = intervalMs;
    this._setInterval = setIntervalFn || ((fn, ms) => setInterval(fn, ms));
    this._clearInterval = clearIntervalFn || ((handle) => clearInterval(handle));
    this._timer = null;
    this._t = 0;
    this._drive = 0.25;
    this._failConnect = failConnect;
    this._lastCalibration = null;
  }

  get id() { return 'mock'; }
  get isSimulated() { return true; }
  getStatus() { return this._status; }

  async checkDevice() {
    return { available: true, simulated: true, device: null, message: 'No hardware attached. Simulation available.' };
  }

  async connect() {
    if (this._status === BCI_STATUS.CONNECTED || this._status === BCI_STATUS.STREAMING) return this._status;
    this._setStatus(BCI_STATUS.CONNECTING);
    if (this._failConnect) {
      this._setStatus(BCI_STATUS.ERROR);
      throw new BciError('connect_failed', 'Simulated adapter was configured to fail.');
    }
    this._setStatus(BCI_STATUS.CONNECTED);
    return this._status;
  }

  async disconnect() {
    await this.stop();
    this._setStatus(BCI_STATUS.DISCONNECTED);
  }

  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  async start() {
    if (this._status === BCI_STATUS.DISCONNECTED || this._status === BCI_STATUS.ERROR) {
      throw new BciError('not_connected', 'Connect the adapter before starting.');
    }
    if (this._status === BCI_STATUS.STREAMING) return;
    this._setStatus(BCI_STATUS.STREAMING);
    if (this._intervalMs > 0) {
      this._timer = this._setInterval(() => this.emitFrame(this._intervalMs / 1000), this._intervalMs);
    }
  }

  async stop() {
    if (this._timer !== null) {
      this._clearInterval(this._timer);
      this._timer = null;
    }
    if (this._status === BCI_STATUS.STREAMING) this._setStatus(BCI_STATUS.CONNECTED);
  }

  async calibrate(task = 'baseline') {
    this._lastCalibration = { task, simulated: true, completedAt: Date.now() };
    return { ...this._lastCalibration, message: 'Simulated calibration step. No signal was measured.' };
  }

  getSignalQuality() {
    // Deliberately non-numeric: a simulation has no signal quality to report.
    return { level: 'simulated', label: 'Simulated — no real measurement', simulated: true };
  }

  /** Advance the animation driver by dt seconds and notify subscribers. */
  emitFrame(dt = 0.1) {
    this._t += dt;
    const wander = (this._rand() - 0.5) * 0.12;
    const slow = 0.5 + 0.5 * Math.sin(this._t * 0.9);
    this._drive = Math.min(1, Math.max(0, 0.55 * this._drive + 0.45 * (0.25 + 0.5 * slow) + wander));
    const frame = Object.freeze({
      source: SIGNAL_SOURCE.SIMULATED,
      simulated: true,
      t: this._t,
      drive: this._drive,
    });
    this._listeners.forEach((callback) => {
      try { callback(frame); } catch (error) { console.error('Spark BCI listener failed', error); }
    });
    return frame;
  }

  _setStatus(next) {
    this._status = next;
    this._listeners.forEach((callback) => {
      try { callback({ type: 'status', status: next, simulated: true }); } catch (error) { console.error('Spark BCI listener failed', error); }
    });
  }
}

const factories = new Map([['mock', (options) => new MockBciAdapter(options)]]);

export function registerBciAdapter(kind, factory) {
  if (!kind || typeof factory !== 'function') throw new TypeError('registerBciAdapter(kind, factory) requires a factory function.');
  factories.set(kind, factory);
}

export function createBciAdapter(kind = 'mock', options) {
  const factory = factories.get(kind);
  if (!factory) throw new BciError('unknown_adapter', `Unknown BCI adapter "${kind}".`);
  return factory(options);
}

/** Human-readable provenance of a result, so the UI never blurs the layers. */
export function describeProvenance(provenance, language = 'en') {
  const zh = language === 'zh';
  switch (provenance) {
    case 'device': return zh ? '设备数据' : 'Device data';
    case 'inference': return zh ? '算法推断' : 'Algorithmic inference';
    case 'ai': return zh ? 'AI 生成' : 'AI generated';
    case 'demo': return zh ? '演示结果（非 AI 生成）' : 'Demo render (not AI generated)';
    default: return zh ? '用户输入' : 'User input';
  }
}
