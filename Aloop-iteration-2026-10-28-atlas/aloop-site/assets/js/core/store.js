(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const memory = new Map();
  function get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return memory.has(key) ? memory.get(key) : fallback;
    }
  }
  function set(key, value) {
    const stringValue = String(value);
    memory.set(key, stringValue);
    try { localStorage.setItem(key, stringValue); return true; } catch (_) { return false; }
  }
  function remove(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch (_) { /* private mode / disabled storage */ }
  }
  function getJSON(key, fallback = null) {
    try { const value = get(key, null); return value === null ? fallback : JSON.parse(value); }
    catch (_) { return fallback; }
  }
  function setJSON(key, value) { return set(key, JSON.stringify(value)); }
  Aloop.store = { get, set, remove, getJSON, setJSON };
})();
