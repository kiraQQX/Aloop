(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const AUTH_KEY = "aloop_auth_v1";
  const embedded = document.documentElement.classList.contains("vue-embedded");
  const listeners = new Set();
  let user = null;
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  let settled = false;

  function bridge() {
    try {
      if (window.parent === window) return null;
      const api = window.parent.__ALOOP_AUTH__;
      return api && typeof api.signIn === "function" ? api : null;
    } catch (_) { return null; }
  }
  const backend = embedded ? bridge() : null;
  // No shell (standalone.html or a directly opened legacy.html): keep the local
  // debug adapter so the reference build still works offline.
  const mode = backend ? "supabase" : "local-debug";

  function settle() {
    if (settled) return;
    settled = true;
    readyResolve();
  }

  function notify() {
    listeners.forEach(callback => { try { callback(user); } catch (error) { console.error("Aloop auth listener failed", error); } });
    document.dispatchEvent(new CustomEvent("aloop:auth-change", { detail: { user } }));
  }

  function restoreLocal() {
    try {
      const saved = Aloop.store?.getJSON(AUTH_KEY, null);
      if (saved && saved.mode === "local-debug") user = saved;
    } catch (_) { user = null; }
  }

  const localBackend = {
    async signIn(email, password) {
      // Local-only debug adapter, used when the Supabase-backed shell is absent.
      if (String(email ?? "").trim() !== "1" || String(password ?? "") !== "1") {
        return { ok: false, reason: "invalid_credentials" };
      }
      user = { id: "debug-local", email: "1", label: "1", mode: "local-debug" };
      Aloop.store?.setJSON(AUTH_KEY, user);
      notify();
      return { ok: true, user };
    },
    async signUp() { return { ok: false, reason: "not_enabled" }; },
    async signOut() {
      user = null;
      Aloop.store?.remove(AUTH_KEY);
      notify();
      return { ok: true };
    },
  };

  const auth = {
    mode,
    get user() { return user; },
    get isSignedIn() { return Boolean(user); },
    get ready() { return ready; },
    onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    // Called by the shell after restoring/invalidating the Supabase session.
    applySession(next) {
      user = next || null;
      settle();
      notify();
    },
    async signIn(email, password) {
      if (!backend) return localBackend.signIn(email, password);
      settle();
      return backend.signIn(email, password);
    },
    async signUp(email, password) {
      if (!backend) return localBackend.signUp(email, password);
      settle();
      return backend.signUp(email, password);
    },
    async signOut() {
      if (!backend) return localBackend.signOut();
      settle();
      return backend.signOut();
    },
  };

  if (!backend) {
    restoreLocal();
    settle();
  } else {
    // The shell pushes the restored session as soon as the frame loads. If it
    // never arrives (broken bridge), fall back to an unauthenticated state so
    // the runtime is never stuck on a permanent loading gate.
    window.setTimeout(() => { if (!settled) { user = null; settle(); notify(); } }, 6000);
  }

  Aloop.auth = auth;
  Aloop.authReady = ready;
})();
