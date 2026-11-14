(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const store = Aloop.store;
  let enabled = store ? store.get("aloop_sound_v1", "1") !== "0" : true;
  let audioContext = null;
  let master = null;
  let compressor = null;
  let lastHoverAt = 0;
  const voices = [];
  let noiseBuffer = null;
  let glide = null;
  const pitches = [587.33, 659.25, 739.99, 880, 987.77];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function ensureContext() {
    if (audioContext) {
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      return audioContext;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioContext = new Ctx();
      master = audioContext.createGain();
      compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -26;
      compressor.knee.value = 15;
      compressor.ratio.value = 4;
      compressor.attack.value = .004;
      compressor.release.value = .22;
      master.gain.value = .5;
      master.connect(compressor).connect(audioContext.destination);
      const length = Math.floor(audioContext.sampleRate * 2);
      noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length * .14);
      return audioContext;
    } catch (_) { audioContext = null; return null; }
  }
  function isEnabled() { return enabled; }
  function setEnabled(next) {
    enabled = Boolean(next);
    if (store) store.set("aloop_sound_v1", enabled ? "1" : "0");
    if (master && audioContext) master.gain.setTargetAtTime(enabled && !Aloop.isExperimentRunning ? .5 : 0, audioContext.currentTime, .012);
    if (!enabled) stopGlassGlide();
    if (Aloop.i18n) Aloop.i18n.apply();
    return enabled;
  }
  function playTone(frequency, startTime, duration, gainValue, waveform = "sine", detune = 0) {
    const ctx = ensureContext();
    if (!ctx || !master || !enabled || Aloop.isExperimentRunning) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, startTime);
    osc.detune.setValueAtTime(detune, startTime);
    gain.gain.setValueAtTime(.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, gainValue), startTime + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, startTime + duration);
    osc.connect(gain).connect(master);
    osc.start(startTime);
    osc.stop(startTime + duration + .04);
    voices.push(osc);
    osc.onended = () => { const i = voices.indexOf(osc); if (i >= 0) voices.splice(i, 1); };
  }
  function chime(kind = "click") {
    if (!enabled || Aloop.isExperimentRunning) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === "hover") {
      const tick = performance.now();
      if (tick - lastHoverAt < 70) return;
      lastHoverAt = tick;
    }
    const freq = pitches[Math.floor(Math.random() * pitches.length)] * (kind === "hover" ? 2 : 1);
    const dur = kind === "hover" ? .35 : .8;
    const volume = kind === "hover" ? .018 : .045;
    playTone(freq, now, dur, volume, "sine");
    playTone(freq * 2.01, now, dur * .72, volume * .28, "sine");
    playTone(freq * 3.02, now, dur * .5, volume * .1, "sine");
    if (kind !== "hover") playTone(freq * .5, now + .06, .48, volume * .14, "sine");
  }
  function tink() {
    if (!enabled || Aloop.isExperimentRunning) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(1046.5, now, .55, .05, "sine");
    playTone(1046.5 * 2.76, now + .008, .36, .018, "sine");
  }
  function glassGlide(y01, speed) {
    if (!enabled || Aloop.isExperimentRunning) return;
    const ctx = ensureContext();
    if (!ctx || !master) return;
    if (!glide) {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      source.buffer = noiseBuffer;
      source.loop = true;
      filter.type = "bandpass";
      filter.Q.value = 60;
      gain.gain.value = .0001;
      shimmer.type = "sine";
      shimmer.frequency.value = 26;
      shimmerGain.gain.value = 0;
      source.connect(filter).connect(gain).connect(master);
      shimmer.connect(shimmerGain).connect(gain.gain);
      source.start(); shimmer.start();
      glide = { source, filter, gain, shimmer, shimmerGain };
    }
    const now = ctx.currentTime;
    const f = 900 + (1 - clamp(y01, 0, 1)) * 1300;
    glide.filter.frequency.setTargetAtTime(f, now, .03);
    glide.gain.gain.setTargetAtTime(clamp(speed, 0, 1) * .035, now, .025);
    glide.shimmerGain.gain.setTargetAtTime(clamp(speed, 0, 1) * .003, now, .03);
  }
  function stopGlassGlide() {
    if (!glide || !audioContext) return;
    const current = glide;
    const now = audioContext.currentTime;
    current.gain.gain.setTargetAtTime(.0001, now, .045);
    current.shimmerGain.gain.setTargetAtTime(0, now, .04);
    window.setTimeout(() => {
      try { current.source.stop(); current.shimmer.stop(); } catch (_) {}
      try { current.source.disconnect(); current.filter.disconnect(); current.gain.disconnect(); current.shimmer.disconnect(); current.shimmerGain.disconnect(); } catch (_) {}
      if (glide === current) glide = null;
    }, 260);
  }
  function setExperimentActive(active) {
    if (master && audioContext) master.gain.setTargetAtTime(enabled && !active ? .5 : 0, audioContext.currentTime, .012);
    if (active) stopGlassGlide();
  }
  function bindGestureUnlock() {
    const unlock = () => { if (enabled) ensureContext(); document.removeEventListener("pointerdown", unlock); document.removeEventListener("touchstart", unlock); };
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("touchstart", unlock, { passive: true });
  }
  bindGestureUnlock();
  Aloop.audio = { ensureContext, isEnabled, setEnabled, chime, tink, glassGlide, stopGlassGlide, setExperimentActive };
})();
