/* Voice-over narration (TTS-1..12): provider interface + Web Speech implementation. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const MAX_CHARS = 220;
  const LOCALE = { zh: ["zh-CN", "zh"], en: ["en-US", "en"] };

  /** Split a paragraph into sentence chunks <= MAX_CHARS (TTS-2, TTS-10). */
  function chunk(text) {
    const sentences = text.match(/[^。！？.!?；;]+[。！？.!?；;]?\s*/g) || [text];
    const out = [];
    let cur = "";
    for (const s of sentences) {
      if ((cur + s).length > MAX_CHARS && cur) { out.push(cur.trim()); cur = ""; }
      cur += s;
      while (cur.length > MAX_CHARS) { out.push(cur.slice(0, MAX_CHARS)); cur = cur.slice(MAX_CHARS); }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  class WebSpeechProvider {
    constructor() { this.synth = window.speechSynthesis || null; this.handlers = {}; this.gen = 0; }
    get supported() { return !!(this.synth && window.SpeechSynthesisUtterance); }
    on(name, cb) { this.handlers[name] = cb; }
    emit(name, ...a) { this.handlers[name]?.(...a); }
    async getVoices() {
      if (!this.supported) return [];
      let v = this.synth.getVoices();
      if (v.length) return v;
      await new Promise(res => {
        const done = () => { this.synth.removeEventListener("voiceschanged", done); res(); };
        this.synth.addEventListener("voiceschanged", done);
        setTimeout(done, 1500);
      });
      return this.synth.getVoices();
    }
    /** Voices matching the locale, local voices first (TTS-3). */
    async voicesFor(lang) {
      const [exact, prefix] = LOCALE[lang];
      const all = await this.getVoices();
      const match = all.filter(v => v.lang === exact || v.lang.toLowerCase().startsWith(prefix.toLowerCase() + "-") || v.lang.toLowerCase() === prefix);
      return match.sort((a, b) => (b.lang === exact) - (a.lang === exact) || (b.localService - a.localService));
    }
    speak(segments, { lang, voice, rate = 1, start = 0 }) {
      this.cancel();
      const gen = ++this.gen;
      const run = i => {
        if (gen !== this.gen) return;
        if (i >= segments.length) { this.emit("end"); return; }
        this.emit("paragraph", i);
        const parts = chunk(segments[i]);
        const next = j => {
          if (gen !== this.gen) return;
          if (j >= parts.length) { run(i + 1); return; }
          const u = new SpeechSynthesisUtterance(parts[j]);
          u.lang = voice?.lang || LOCALE[lang][0];
          if (voice) u.voice = voice;
          u.rate = rate;
          u.onend = () => next(j + 1);
          u.onerror = e => { if (gen === this.gen && e.error !== "interrupted" && e.error !== "canceled") this.emit("error", e.error); };
          this.synth.speak(u);
        };
        next(0);
      };
      run(start);
    }
    pause() { this.synth?.pause(); }
    resume() { this.synth?.resume(); }
    cancel() { this.gen++; this.synth?.cancel(); }
  }

  Aloop.narration = { WebSpeechProvider, chunk };
})();
