// Capture helpers: countdown, voice input, fragment normalisation, image intake.
// Nothing here starts recording on its own: VoiceCapture.start() must be called
// from a user gesture, and no audio is ever stored or uploaded by Spark.

export const COUNTDOWN_SECONDS = 8;
export const FRAGMENT_KEYS = Object.freeze(['subject', 'color', 'space', 'motion', 'emotion', 'other']);
export const MAX_FRAGMENT_LENGTH = 500;
export const MAX_TEXT_LENGTH = 4000;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export function createCountdown({ seconds = COUNTDOWN_SECONDS, onTick = () => {}, onDone = () => {}, setIntervalFn, clearIntervalFn } = {}) {
  const set = setIntervalFn || ((fn, ms) => setInterval(fn, ms));
  const clear = clearIntervalFn || ((handle) => clearInterval(handle));
  let remaining = seconds;
  let timer = null;
  const stop = () => {
    if (timer !== null) { clear(timer); timer = null; }
  };
  return {
    get remaining() { return remaining; },
    get running() { return timer !== null; },
    start() {
      stop();
      remaining = seconds;
      onTick(remaining);
      timer = set(() => {
        remaining -= 1;
        onTick(remaining);
        if (remaining <= 0) { stop(); onDone(); }
      }, 1000);
    },
    cancel: stop,
  };
}

export function normalizeFragments(raw = {}) {
  const out = {};
  for (const key of FRAGMENT_KEYS) {
    const value = typeof raw[key] === 'string' ? raw[key].replace(/\s+/g, ' ').trim().slice(0, MAX_FRAGMENT_LENGTH) : '';
    if (value) out[key] = value;
  }
  return out;
}

export function normalizeText(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_LENGTH) : '';
}

export function hasCaptureContent({ text = '', fragments = {}, image = null } = {}) {
  return Boolean(normalizeText(text) || Object.keys(normalizeFragments(fragments)).length || image);
}

/** Which input channels actually contributed, used as the idea's input_mode. */
export function detectInputMode({ text = '', fragments = {}, image = null, voiceUsed = false, guided = false } = {}) {
  const modes = [];
  if (voiceUsed) modes.push('voice');
  if (Object.keys(normalizeFragments(fragments)).length) modes.push('fragments');
  if (image) modes.push('image');
  if (normalizeText(text) && !voiceUsed) modes.push('imagery');
  if (!modes.length && guided) modes.push('imagery');
  if (modes.length > 1) return 'mixed';
  return modes[0] || 'imagery';
}

export function getSpeechSupport(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return { recognition: false, recorder: false, microphone: false };
  const recognition = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  const microphone = Boolean(win.navigator?.mediaDevices?.getUserMedia);
  const recorder = microphone && typeof win.MediaRecorder === 'function';
  return { recognition, recorder, microphone };
}

export class CaptureError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CaptureError';
    this.code = code;
  }
}

const RECOGNITION_ERRORS = {
  'not-allowed': 'permission_denied',
  'service-not-allowed': 'permission_denied',
  'no-speech': 'no_speech',
  'audio-capture': 'no_device',
  network: 'network',
  aborted: 'aborted',
};

/**
 * Browser speech-to-text. Uses SpeechRecognition when the browser offers it;
 * otherwise reports `unsupported` so the UI falls back to typing. Audio is never
 * kept. NOTE: in several browsers SpeechRecognition sends audio to a vendor
 * service; the UI shows that notice before the user starts.
 */
export class VoiceCapture {
  constructor({ win = typeof window !== 'undefined' ? window : undefined, lang = 'zh-CN', onTranscript = () => {}, onState = () => {}, onError = () => {} } = {}) {
    this.win = win;
    this.lang = lang;
    this.onTranscript = onTranscript;
    this.onState = onState;
    this.onError = onError;
    this.state = 'idle';
    this._recognition = null;
    this._finalText = '';
  }

  _setState(state) {
    this.state = state;
    this.onState(state);
  }

  _fail(code, message) {
    const error = new CaptureError(code, message);
    this._setState('error');
    this.onError(error);
    return error;
  }

  start() {
    const support = getSpeechSupport(this.win);
    if (!support.recognition) {
      return this._fail('unsupported', 'Speech-to-text is not available in this browser. Type your description instead.');
    }
    if (this.state === 'listening') return null;
    const Recognition = this.win.SpeechRecognition || this.win.webkitSpeechRecognition;
    let recognition;
    try {
      recognition = new Recognition();
    } catch (error) {
      return this._fail('unsupported', error?.message || 'Speech recognition could not start.');
    }
    recognition.lang = this.lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    this._finalText = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) this._finalText += piece;
        else interim += piece;
      }
      this.onTranscript(`${this._finalText}${interim}`.trim(), !interim);
    };
    recognition.onerror = (event) => {
      const code = RECOGNITION_ERRORS[event?.error] || 'recognition_failed';
      if (code === 'aborted') return;
      this._fail(code, event?.message || `Speech recognition error: ${event?.error || 'unknown'}`);
    };
    recognition.onend = () => {
      if (this.state === 'listening') this._setState('idle');
      this._recognition = null;
    };
    this._recognition = recognition;
    try {
      recognition.start();
      this._setState('listening');
    } catch (error) {
      this._recognition = null;
      return this._fail('recognition_failed', error?.message || 'Speech recognition could not start.');
    }
    return null;
  }

  stop() {
    try { this._recognition?.stop(); } catch { /* already stopped */ }
    if (this.state === 'listening') this._setState('idle');
  }

  cancel() {
    const recognition = this._recognition;
    this._recognition = null;
    try { recognition?.abort(); } catch { /* already stopped */ }
    if (this.state !== 'idle') this._setState('idle');
  }
}

export function validateReferenceImage(file) {
  if (!file) return new CaptureError('no_file', 'No file selected.');
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type || '')) return new CaptureError('bad_type', 'Choose a PNG, JPEG, WebP, or GIF image.');
  if (file.size > MAX_IMAGE_BYTES) return new CaptureError('too_large', 'The image is larger than 3 MB.');
  return null;
}

/** Reads a validated image into a data URL held in memory only (not persisted locally). */
export function readReferenceImage(file, { FileReaderImpl = typeof FileReader !== 'undefined' ? FileReader : null } = {}) {
  const problem = validateReferenceImage(file);
  if (problem) return Promise.reject(problem);
  if (!FileReaderImpl) return Promise.reject(new CaptureError('unsupported', 'This browser cannot read local images.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReaderImpl();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result || '') });
    reader.onerror = () => reject(new CaptureError('read_failed', 'The image could not be read.'));
    reader.readAsDataURL(file);
  });
}
