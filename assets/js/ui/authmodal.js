(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const backdrop = document.getElementById("authBackdrop");
  const modal = document.getElementById("authModal");
  const openButton = document.getElementById("authOpen");
  const closeButton = document.getElementById("authClose");
  const loginTab = document.getElementById("authLoginTab");
  const signupTab = document.getElementById("authSignupTab");
  const title = document.getElementById("authTitle");
  const form = document.getElementById("authForm");
  const emailInput = document.getElementById("authEmail");
  const emailWrap = document.getElementById("authEmailWrap");
  const password = document.getElementById("authPassword");
  const passwordLabel = document.getElementById("authPasswordLabel");
  const confirmWrap = document.getElementById("authConfirmWrap");
  const confirm = document.getElementById("authConfirm");
  const captchaWrap = document.getElementById("authCaptcha");
  const submitButton = document.querySelector("#authForm .auth-submit");
  const submitLabel = document.querySelector("#authForm .auth-submit span");
  const message = document.getElementById("authMessage");
  const resendButton = document.getElementById("authResend");
  const forgotButton = document.getElementById("authForgot");
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MIN_PASSWORD = 8;
  let mode = "login";
  let previousFocus = null;
  let busy = false;
  let captchaToken = "";
  let captchaWidget = null;
  let captchaScript = null;

  function t(key) { return Aloop.i18n ? Aloop.i18n.t(key) : key; }
  function say(key, vars) {
    let text = key ? t(key) : "";
    Object.entries(vars || {}).forEach(([name, value]) => { text = text.replace(`{${name}}`, value); });
    message.textContent = text;
  }
  function showResend(visible) { if (resendButton) resendButton.hidden = !visible; }

  /* ---- optional Cloudflare Turnstile (enabled when ALOOP_CONFIG.turnstileSiteKey is set) ---- */
  function captchaKey() { return String(window.ALOOP_CONFIG?.turnstileSiteKey || ""); }
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (captchaScript) return captchaScript;
    captchaScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { captchaScript = null; reject(new Error("Turnstile failed to load")); };
      document.head.appendChild(script);
    });
    return captchaScript;
  }
  async function mountCaptcha() {
    if (!captchaKey() || !captchaWrap) return;
    captchaWrap.hidden = false;
    if (captchaWidget !== null) return;
    try {
      await loadTurnstile();
      captchaWidget = window.turnstile.render(captchaWrap, {
        sitekey: captchaKey(),
        callback: token => { captchaToken = token; },
        "expired-callback": () => { captchaToken = ""; },
        "error-callback": () => { captchaToken = ""; },
      });
    } catch (_) { say("auth.network"); }
  }
  function resetCaptcha() {
    captchaToken = "";
    if (captchaWidget !== null && window.turnstile) window.turnstile.reset(captchaWidget);
  }

  function setBusy(next) {
    busy = next;
    if (submitButton) submitButton.disabled = next;
    if (resendButton) resendButton.disabled = next;
  }

  function setMode(next, { keepMessage = false } = {}) {
    mode = next === "signup" ? "signup" : (next === "recovery" ? "recovery" : "login");
    const isSignup = mode === "signup";
    const isRecovery = mode === "recovery";
    loginTab.classList.toggle("is-active", !isSignup && !isRecovery);
    signupTab.classList.toggle("is-active", isSignup);
    loginTab.setAttribute("aria-selected", String(!isSignup && !isRecovery));
    signupTab.setAttribute("aria-selected", String(isSignup));
    loginTab.hidden = isRecovery;
    signupTab.hidden = isRecovery;
    title.textContent = t(isRecovery ? "auth.recoveryTitle" : (isSignup ? "auth.signup.title" : "auth.login.title"));
    submitLabel.textContent = t(isRecovery ? "auth.recoverySubmit" : (isSignup ? "auth.submit.signup" : "auth.submit.login"));
    if (emailWrap) emailWrap.hidden = isRecovery;
    confirmWrap.hidden = !isSignup && !isRecovery;
    passwordLabel.textContent = t(isRecovery ? "auth.newPassword" : "auth.password");
    passwordLabel.dataset.i18n = isRecovery ? "auth.newPassword" : "auth.password";
    password.autocomplete = (isSignup || isRecovery) ? "new-password" : "current-password";
    confirm.required = isSignup || isRecovery;
    if (forgotButton) forgotButton.hidden = mode !== "login" || !Aloop.auth?.configured;
    if (!keepMessage) { say(""); showResend(false); }
    if (captchaKey()) mountCaptcha();
    if (!Aloop.auth?.configured) say("auth.notConfigured");
  }

  function syncAccountLabel() {
    if (!openButton) return;
    const signedIn = Boolean(Aloop.auth?.user);
    openButton.textContent = t(signedIn ? "nav.account" : "nav.auth").replace("{id}", Aloop.auth?.user?.label || "");
    openButton.setAttribute("aria-label", t(signedIn ? "auth.signoutLabel" : "nav.auth"));
    openButton.dataset.i18n = signedIn ? "nav.account" : "nav.auth";
  }

  /* options.notice: "verified" | "verify_failed" | "recovery" - set by the page shell. */
  function open(options = {}) {
    if (!backdrop) return;
    previousFocus = document.activeElement;
    backdrop.hidden = false;
    if (options.notice === "recovery") {
      setMode("recovery");
      window.setTimeout(() => password?.focus({ preventScroll: true }), 20);
    } else {
      setMode("login");
      if (options.notice === "verified") say("auth.verified");
      else if (options.notice === "verify_failed") { say("auth.verifyFailed"); showResend(true); }
      window.setTimeout(() => emailInput?.focus({ preventScroll: true }), 20);
    }
    document.body.classList.add("modal-open");
  }
  function close() {
    backdrop.hidden = true;
    document.body.classList.remove("modal-open");
    setBusy(false);
    password.value = "";
    confirm.value = "";
    if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("aloop:auth-modal-closed"));
  }

  openButton?.addEventListener("click", () => {
    if (!Aloop.auth?.user) { open(); return; }
    if (window.confirm(t("auth.signoutConfirm"))) Aloop.auth.signOut();
  });
  Aloop.auth?.onChange(syncAccountLabel);
  document.addEventListener("aloop:language", syncAccountLabel);
  closeButton?.addEventListener("click", close);
  loginTab?.addEventListener("click", () => setMode("login"));
  signupTab?.addEventListener("click", () => setMode("signup"));
  backdrop?.addEventListener("click", event => { if (event.target === backdrop) close(); });
  document.addEventListener("keydown", event => {
    if (backdrop.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(el => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
  });

  const ERROR_KEYS = {
    invalid_credentials: "auth.validation.credentials",
    email_not_confirmed: "auth.notConfirmed",
    weak_password: "auth.weakPassword",
    captcha_failed: "auth.validation.captcha",
    rate_limit: "auth.rateLimit",
    network: "auth.network",
    not_configured: "auth.notConfigured",
    no_session: "auth.recoveryFailed",
    not_supported: "auth.error",
  };

  async function submitSignup(email) {
    const result = await Aloop.auth.signUp(email, password.value, { captchaToken });
    resetCaptcha();
    if (!result.ok) { say(ERROR_KEYS[result.reason] || "auth.error"); return; }
    if (!result.needsConfirmation) {
      say("auth.loginSuccess");
      close();
      document.dispatchEvent(new CustomEvent("aloop:auth-success", { detail: { user: result.user } }));
      return;
    }
    // Verification email is on its way: switch to the login tab, keep the address, explain the next step.
    setMode("login", { keepMessage: true });
    emailInput.value = email;
    password.value = "";
    confirm.value = "";
    say("auth.signupSent", { email });
    showResend(true);
  }

  async function submitLogin(email) {
    const result = await Aloop.auth.signIn(email, password.value, { captchaToken });
    resetCaptcha();
    if (!result.ok) {
      say(ERROR_KEYS[result.reason] || "auth.error");
      showResend(result.reason === "email_not_confirmed");
      if (result.reason === "invalid_credentials") password.select();
      return;
    }
    say("auth.loginSuccess");
    close();
    document.dispatchEvent(new CustomEvent("aloop:auth-success", { detail: { user: result.user } }));
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    if (mode === "recovery") {
      if (!password.value || password.value.length < MIN_PASSWORD) { say("auth.validation.passwordLength"); password.focus(); return; }
      if (password.value !== confirm.value) { say("auth.validation.confirm"); confirm.focus(); return; }
      if (!Aloop.auth?.configured) { say("auth.notConfigured"); return; }
      if (captchaKey() && !captchaToken) { say("auth.validation.captcha"); return; }
      setBusy(true);
      say("auth.sending");
      try {
        const result = await Aloop.auth.updatePassword(password.value);
        if (!result?.ok) { say(ERROR_KEYS[result?.reason] || "auth.recoveryFailed"); return; }
        password.value = "";
        confirm.value = "";
        resetCaptcha();
        setMode("login", { keepMessage: true });
        say("auth.recoveryDone");
      } finally { setBusy(false); }
      return;
    }
    const email = emailInput.value.trim();
    if (!EMAIL_PATTERN.test(email)) { say("auth.validation.email"); emailInput.focus(); return; }
    if (!password.value) { say("auth.validation.password"); password.focus(); return; }
    if (mode === "signup") {
      if (password.value.length < MIN_PASSWORD) { say("auth.validation.passwordLength"); password.focus(); return; }
      if (password.value !== confirm.value) { say("auth.validation.confirm"); confirm.focus(); return; }
    }
    if (!Aloop.auth?.configured) { say("auth.notConfigured"); return; }
    if (captchaKey() && !captchaToken) { say("auth.validation.captcha"); return; }
    showResend(false);
    say("auth.sending");
    setBusy(true);
    try {
      if (mode === "signup") await submitSignup(email); else await submitLogin(email);
    } finally { setBusy(false); }
  });

  resendButton?.addEventListener("click", async () => {
    if (busy) return;
    const email = emailInput.value.trim();
    if (!EMAIL_PATTERN.test(email)) { say("auth.validation.email"); emailInput.focus(); return; }
    if (captchaKey() && !captchaToken) { say("auth.validation.captcha"); return; }
    setBusy(true);
    try {
      const result = await Aloop.auth.resendVerification(email, { captchaToken });
      resetCaptcha();
      say(result.ok ? "auth.resendSent" : (ERROR_KEYS[result.reason] || "auth.error"));
    } finally { setBusy(false); }
  });

  forgotButton?.addEventListener("click", async () => {
    if (busy) return;
    const email = emailInput.value.trim();
    if (!EMAIL_PATTERN.test(email)) { say("auth.validation.email"); emailInput.focus(); return; }
    if (!Aloop.auth?.configured) { say("auth.notConfigured"); return; }
    if (captchaKey() && !captchaToken) { say("auth.validation.captcha"); return; }
    setBusy(true);
    say("auth.sending");
    try {
      const result = await Aloop.auth.requestPasswordReset(email, { captchaToken });
      resetCaptcha();
      say(result?.ok ? "auth.resetSent" : (ERROR_KEYS[result?.reason] || "auth.error"), { email });
    } finally { setBusy(false); }
  });

  // A recovery link either reaches this document directly or is announced by the
  // shell after Supabase consumed it. Both paths open the same dialog.
  document.addEventListener("aloop:auth-recovery", () => open({ notice: "recovery" }));
  if (Aloop.auth?.recoveryPending) open({ notice: "recovery" });

  Aloop.authModal = { open, close, setMode, syncAccountLabel };
  syncAccountLabel();
  document.addEventListener("DOMContentLoaded", syncAccountLabel, { once: true });
})();
