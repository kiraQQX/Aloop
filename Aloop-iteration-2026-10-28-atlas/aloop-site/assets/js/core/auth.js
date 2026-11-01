/* Aloop account client — one public interface, two exclusive modes.
 *
 * 1. Shell mode (the normal website): the Vue shell owns the Supabase session
 *    through `@supabase/supabase-js` and exposes it as `window.__ALOOP_AUTH__`.
 *    This classic runtime only delegates; it never keeps or refreshes a token.
 *
 * 2. Standalone mode (`standalone.html` or a directly opened `legacy.html`, or
 *    an embedded shell without Supabase configuration): no bridge exists, so
 *    this file logs in against Supabase Auth (GoTrue) over its REST API. The
 *    public project URL and publishable key come from
 *    `assets/js/core/config.js`; a service_role key must never appear there.
 *
 * The two modes are mutually exclusive: a document is either bridged or
 * standalone, and only the active backend is ever used.
 */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const SESSION_KEY = "aloop_session_v2";
  const LEGACY_DEBUG_KEY = "aloop_auth_v1";
  const embedded = document.documentElement.classList.contains("vue-embedded");
  const listeners = new Set();

  const config = () => window.ALOOP_CONFIG || {};
  const baseUrl = () => String(config().supabaseUrl || "").replace(/\/+$/, "");
  const apiKey = () => String(config().supabaseAnonKey || "");
  const isConfigured = () => Boolean(baseUrl() && apiKey());
  const siteUrl = () => String(config().siteUrl || window.location.origin).replace(/\/+$/, "");

  function bridge() {
    try {
      if (window.parent === window) return null;
      const api = window.parent.__ALOOP_AUTH__;
      return api && typeof api.signIn === "function" ? api : null;
    } catch (_) { return null; }
  }

  const backend = embedded ? bridge() : null;
  const mode = backend ? "shell" : "standalone";

  let shellUser = null;
  let session = null;
  let refreshTimer = null;
  let recoveryToken = "";
  let recoveryPending = false;
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  let settled = false;

  function settle() {
    if (settled) return;
    settled = true;
    readyResolve();
  }

  function currentUser() {
    return backend ? shellUser : (session?.user || null);
  }

  function notify() {
    const user = currentUser();
    listeners.forEach(callback => { try { callback(user); } catch (error) { console.error("Aloop auth listener failed", error); } });
    document.dispatchEvent(new CustomEvent("aloop:auth-change", { detail: { user } }));
  }

  /* ---------------------------- REST backend ---------------------------- */

  function toUser(raw) {
    if (!raw || !raw.id) return null;
    const email = String(raw.email || "");
    return { id: raw.id, email, label: email.split("@")[0].slice(0, 18) || email };
  }

  function persist() {
    try {
      if (session) Aloop.store?.setJSON(SESSION_KEY, session);
      else Aloop.store?.remove(SESSION_KEY);
    } catch (_) { /* storage can be unavailable; the session then lives in memory only */ }
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    if (!session?.refreshToken) return;
    const wait = Math.max(5, (session.expiresAt || 0) - Math.floor(Date.now() / 1000) - 60) * 1000;
    refreshTimer = window.setTimeout(refreshSession, Math.min(wait, 2147483000));
  }

  function setSession(payload) {
    const user = toUser(payload.user);
    if (!payload.access_token || !user) return false;
    session = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || "",
      expiresAt: payload.expires_at || (Math.floor(Date.now() / 1000) + (payload.expires_in || 3600)),
      user,
    };
    persist();
    scheduleRefresh();
    return true;
  }

  function clearSession() {
    window.clearTimeout(refreshTimer);
    session = null;
    persist();
  }

  function mapError(status, data) {
    const code = String(data?.error_code || data?.code || "");
    const message = String(data?.msg || data?.message || data?.error_description || "").toLowerCase();
    if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "email_not_confirmed";
    if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "invalid_credentials";
    if (code === "weak_password" || message.includes("password should be")) return "weak_password";
    if (code === "captcha_failed" || message.includes("captcha")) return "captcha_failed";
    if (status === 429 || code.includes("rate_limit")) return "rate_limit";
    if (code === "signup_disabled" || code === "email_provider_disabled") return "not_configured";
    return "unknown";
  }

  async function request(path, { method = "POST", body, token, query } = {}) {
    if (!isConfigured()) return { ok: false, reason: "not_configured" };
    if (typeof fetch !== "function") return { ok: false, reason: "network" };
    const url = new URL(`${baseUrl()}/auth/v1/${path}`);
    Object.entries(query || {}).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    let response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey(),
          Authorization: `Bearer ${token || apiKey()}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (_) {
      return { ok: false, reason: "network" };
    }
    let data = null;
    try { data = await response.json(); } catch (_) { data = null; }
    if (response.ok) return { ok: true, data };
    return { ok: false, reason: mapError(response.status, data), status: response.status };
  }

  const security = captchaToken => (captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {});

  async function refreshSession() {
    if (!session?.refreshToken) return false;
    const result = await request("token", { query: { grant_type: "refresh_token" }, body: { refresh_token: session.refreshToken } });
    if (result.ok && setSession(result.data)) { notify(); return true; }
    // A rejected refresh token means the session is over; a network failure keeps it for the next try.
    if (result.reason !== "network") { clearSession(); notify(); }
    else { refreshTimer = window.setTimeout(refreshSession, 30000); }
    return false;
  }

  /* Standalone recovery links land on this document with the token in the hash. */
  function readRecoveryHash() {
    const raw = String(window.location.hash || "").replace(/^#/, "");
    if (!raw || raw.startsWith("/")) return;
    const params = new URLSearchParams(raw);
    if (params.get("type") !== "recovery" || !params.get("access_token")) return;
    recoveryToken = params.get("access_token");
    recoveryPending = true;
    try {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/`);
    } catch (_) { /* the URL stays as-is; the token is still usable */ }
    document.dispatchEvent(new CustomEvent("aloop:auth-recovery"));
  }

  /* ------------------------- session bootstrapping ------------------------ */

  if (backend) {
    // One owner only: a standalone session must never leak into shell mode.
    clearSession();
    window.setTimeout(() => { if (!settled) { shellUser = null; settle(); notify(); } }, 6000);
  } else {
    try {
      Aloop.store?.remove(LEGACY_DEBUG_KEY);
      const saved = Aloop.store?.getJSON(SESSION_KEY, null);
      if (saved && saved.accessToken && saved.user?.id) {
        session = saved;
        if ((saved.expiresAt || 0) - 30 <= Math.floor(Date.now() / 1000)) refreshSession();
        else scheduleRefresh();
      }
    } catch (_) { session = null; }
    readRecoveryHash();
    settle();
  }

  /* ------------------------------ interface ------------------------------ */

  const auth = {
    mode,
    get user() { return currentUser(); },
    get isSignedIn() { return Boolean(currentUser()); },
    get configured() { return backend ? true : isConfigured(); },
    get accessToken() { return backend ? "" : (recoveryToken || session?.accessToken || ""); },
    get recoveryPending() { return backend ? false : recoveryPending; },
    get ready() { return ready; },
    onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    // Called by the shell after restoring/invalidating the Supabase session.
    applySession(next) {
      if (!backend) return;
      shellUser = next || null;
      settle();
      notify();
    },

    async signUp(email, password, options = {}) {
      if (backend) return backend.signUp(email, password, options);
      const result = await request("signup", {
        query: { redirect_to: `${siteUrl()}/` },
        body: { email, password, ...security(options.captchaToken) },
      });
      if (!result.ok) return result;
      // Projects with "Confirm email" disabled return a session straight away.
      if (result.data?.access_token && setSession(result.data)) { notify(); return { ok: true, user: session.user, needsConfirmation: false }; }
      return { ok: true, needsConfirmation: true };
    },

    async signIn(email, password, options = {}) {
      if (backend) return backend.signIn(email, password, options);
      const result = await request("token", {
        query: { grant_type: "password" },
        body: { email, password, ...security(options.captchaToken) },
      });
      if (!result.ok) return result;
      if (!setSession(result.data)) return { ok: false, reason: "unknown" };
      notify();
      return { ok: true, user: session.user };
    },

    async signOut() {
      if (backend) return backend.signOut();
      const token = session?.accessToken;
      clearSession();
      notify();
      if (token) request("logout", { token, query: { scope: "local" } }); // best effort; local state is already cleared
      return { ok: true };
    },

    async resendVerification(email, options = {}) {
      if (backend) {
        return typeof backend.resendVerification === "function"
          ? backend.resendVerification(email)
          : { ok: false, reason: "not_supported" };
      }
      return request("resend", {
        query: { redirect_to: `${siteUrl()}/` },
        body: { type: "signup", email, ...security(options.captchaToken) },
      });
    },

    async requestPasswordReset(email, options = {}) {
      if (backend) {
        return typeof backend.requestPasswordReset === "function"
          ? backend.requestPasswordReset(email)
          : { ok: false, reason: "not_supported" };
      }
      return request("recover", {
        query: { redirect_to: `${siteUrl()}/` },
        body: { email, ...security(options.captchaToken) },
      });
    },

    async updatePassword(password) {
      if (backend) {
        return typeof backend.updatePassword === "function"
          ? backend.updatePassword(password)
          : { ok: false, reason: "not_supported" };
      }
      const token = recoveryToken || session?.accessToken;
      if (!token) return { ok: false, reason: "no_session" };
      const result = await request("user", { method: "PUT", token, body: { password } });
      if (!result.ok) return result;
      // A recovered password is a fresh credential: drop the old session and ask for a normal login.
      recoveryToken = "";
      recoveryPending = false;
      if (session) { clearSession(); notify(); }
      return { ok: true };
    },
  };

  Aloop.auth = auth;
  Aloop.authReady = ready;
})();
