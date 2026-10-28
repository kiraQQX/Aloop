/* Minimal, dependency-free page performance diagnostics. These metrics are local-only. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const metrics = { lcp: null, inp: null, cls: 0 };
  const observers = [];
  function observe(type, callback) {
    if (!("PerformanceObserver" in window)) return;
    try {
      const observer = new PerformanceObserver(list => callback(list.getEntries()));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch (_) { /* the browser may not support this entry type */ }
  }
  observe("largest-contentful-paint", entries => {
    const last = entries.at(-1);
    if (last) metrics.lcp = Math.round(last.startTime);
  });
  observe("layout-shift", entries => {
    entries.forEach(entry => { if (!entry.hadRecentInput) metrics.cls += entry.value; });
  });
  observe("event", entries => {
    entries.forEach(entry => {
      if (entry.interactionId && entry.duration > (metrics.inp || 0)) metrics.inp = Math.round(entry.duration);
    });
  });
  Aloop.perf = {
    get metrics() { return { ...metrics, cls: Number(metrics.cls.toFixed(4)) }; },
    isReducedMotion() { return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); },
    dispose() { observers.forEach(observer => observer.disconnect()); observers.length = 0; },
  };
})();
