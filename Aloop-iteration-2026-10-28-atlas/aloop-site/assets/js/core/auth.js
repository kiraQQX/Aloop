(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const AUTH_KEY = "aloop_auth_v1";
  const listeners = new Set();
  let user = null;

  try {
    const saved = Aloop.store?.getJSON(AUTH_KEY, null);
    if (saved && saved.id === "debug-local" && saved.email === "1") user = saved;
  } catch (_) { user = null; }

  function notify() {
    listeners.forEach(callback => { try { callback(user); } catch (error) { console.error("Aloop auth listener failed", error); } });
    document.dispatchEvent(new CustomEvent("aloop:auth-change", { detail: { user } }));
  }
  const auth = {
    get user() { return user; },
    get isSignedIn() { return Boolean(user); },
    onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    async signIn(email, password) {
      // Local-only debug adapter. Replace this with server-side auth before public deployment.
      if (String(email ?? "").trim() !== "1" || String(password ?? "") !== "1") {
        return { ok: false, reason: "invalid_credentials" };
      }
      user = { id: "debug-local", email: "1", label: "1", mode: "local-debug" };
      Aloop.store?.setJSON(AUTH_KEY, user);
      notify();
      return { ok: true, user };
    },
    async signUp() { return { ok: false, reason: "not_enabled" }; },
    signOut() {
      user = null;
      Aloop.store?.remove(AUTH_KEY);
      notify();
    },
  };
  Aloop.auth = auth;
})();
