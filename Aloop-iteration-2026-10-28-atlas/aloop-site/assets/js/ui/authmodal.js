(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const backdrop = document.getElementById("authBackdrop");
  const modal = document.getElementById("authModal");
  const openButton = document.getElementById("authOpen");
  const closeButton = document.getElementById("authClose");
  const loginTab = document.getElementById("authLoginTab");
  const signupTab = document.getElementById("authSignupTab");
  const title = document.getElementById("authTitle");
  const emailInput = document.getElementById("authEmail");
  const password = document.getElementById("authPassword");
  const debugHint = document.getElementById("authDebugHint");
  const confirmWrap = document.getElementById("authConfirmWrap");
  const confirm = document.getElementById("authConfirm");
  const submitLabel = document.querySelector("#authForm .auth-submit span");
  const message = document.getElementById("authMessage");
  let mode = "login";
  let previousFocus = null;
  function t(key) { return Aloop.i18n ? Aloop.i18n.t(key) : key; }
  function setMode(next) {
    mode = next === "signup" ? "signup" : "login";
    const isSignup = mode === "signup";
    loginTab.classList.toggle("is-active", !isSignup);
    signupTab.classList.toggle("is-active", isSignup);
    loginTab.setAttribute("aria-selected", String(!isSignup));
    signupTab.setAttribute("aria-selected", String(isSignup));
    title.textContent = t(isSignup ? "auth.signup.title" : "auth.login.title");
    submitLabel.textContent = t(isSignup ? "auth.submit.signup" : "auth.submit.login");
    confirmWrap.hidden = !isSignup;
    password.autocomplete = isSignup ? "new-password" : "current-password";
    confirm.required = isSignup;
    message.textContent = isSignup ? t("auth.pending") : "";
    if (debugHint) debugHint.hidden = isSignup;
  }
  function syncAccountLabel() {
    if (!openButton) return;
    const signedIn = Boolean(Aloop.auth?.user);
    openButton.textContent = t(signedIn ? "nav.account" : "nav.auth").replace("{id}", Aloop.auth?.user?.label || "1");
    openButton.setAttribute("aria-label", t(signedIn ? "auth.signoutLabel" : "nav.auth"));
    openButton.dataset.i18n = signedIn ? "nav.account" : "nav.auth";
  }
  function open() {
    if (!backdrop) return;
    previousFocus = document.activeElement;
    backdrop.hidden = false;
    setMode("login");
    window.setTimeout(() => document.getElementById("authEmail")?.focus({ preventScroll: true }), 20);
    document.body.classList.add("modal-open");
  }
  function close() {
    backdrop.hidden = true;
    document.body.classList.remove("modal-open");
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
  document.getElementById("authForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) { message.textContent = t("auth.validation.email"); emailInput.focus(); return; }
    if (!password.value) { message.textContent = t("auth.validation.password"); password.focus(); return; }
    if (mode === "signup" && password.value !== confirm.value) { message.textContent = t("auth.validation.confirm"); confirm.focus(); return; }
    if (mode === "signup") { message.textContent = t("auth.pending"); return; }
    const result = await Aloop.auth.signIn(email, password.value);
    if (!result.ok) { message.textContent = t("auth.validation.credentials"); password.select(); return; }
    message.textContent = t("auth.loginSuccess");
    close();
    document.dispatchEvent(new CustomEvent("aloop:auth-success", { detail: { user: result.user } }));
  });
  Aloop.authModal = { open, close, setMode, syncAccountLabel };
  syncAccountLabel();
  document.addEventListener("DOMContentLoaded", syncAccountLabel, { once: true });
})();
