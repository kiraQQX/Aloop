<script setup>
import { computed, onMounted, onBeforeUnmount, nextTick, ref } from 'vue';
import {
  authState,
  getCurrentUser,
  initAuth,
  requestPasswordReset,
  resendVerification,
  signIn,
  signOut,
  signUp,
  subscribeAuth,
  subscribeAuthEvent,
  updatePassword,
} from './lib/auth';
import { isSupabaseConfigured } from './lib/supabase';

// Shared with the legacy runtime (assets/i18n/site.js) so the shell and the
// embedded documents always agree on the active language.
const LANGUAGE_KEY = 'aloop_lang_v1';
const frame = ref(null);
const frameSrc = ref('');
const status = ref('正在加载原有实验环境…');
const language = ref(readStoredLanguage());
const route = ref('home');
const openMenu = ref(null);
const experimentsTrigger = ref(null);
const experimentsPanel = ref(null);
const productsTrigger = ref(null);
const productsPanel = ref(null);

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    // Storage can be unavailable in private mode; fall through to the site default.
  }
  // The site ships as a zh-CN document; Chinese stays the default until a
  // language is chosen explicitly (the legacy runtime then follows the store).
  return 'zh';
}

const copy = computed(() => language.value === 'zh'
  ? { home: '首页', experiments: '实验', products: '产品', easysci: 'EasySci', brain: 'Smart Brain', about: '说明', account: '登录 / 注册', loading: '正在加载原有实验环境…', language: '语言切换', menuTitle: '选择实验', menuSoon: '更多实验即将上线', productsTitle: '产品与工具', easysciDesc: '科研、分析与视觉工具目录', brainDesc: '大脑皮层互动学习与语音讲解' }
  : { home: 'Home', experiments: 'Experiments', products: 'Products', easysci: 'EasySci', brain: 'Smart Brain', about: 'About', account: 'Log in / Sign up', loading: 'Loading the existing research environment…', language: 'Language', menuTitle: 'Choose an experiment', menuSoon: 'More experiments coming soon', productsTitle: 'Products & tools', easysciDesc: 'Research, analysis, and visual tools', brainDesc: 'Interactive cortex lessons with voice-over' });

// The account UI lives inside the legacy runtime; the shell owns the Supabase
// session and forwards it through the bridge, so there is exactly one owner.
let pendingAccountOpen = false;
let pendingAccountNotice = null;

const account = computed(() => authState.user.value);
const authConfigError = computed(() => authState.configError);
// An unconfigured production build must say so instead of silently falling back.
const configWarning = computed(() => (import.meta.env.PROD ? authConfigError.value : null));
// Bridge mode is enabled only when the shell really has a Supabase client. When
// the build has no env vars the iframe keeps its standalone REST client instead.
const bridgeEnabled = isSupabaseConfigured;
const accountText = computed(() => (account.value
  ? `${account.value.label} · ${language.value === 'zh' ? '退出' : 'Sign out'}`
  : copy.value.account));

if (typeof window !== 'undefined' && bridgeEnabled) {
  window.__ALOOP_AUTH__ = {
    signIn,
    signUp,
    signOut,
    getUser: getCurrentUser,
    subscribe: subscribeAuth,
    resendVerification,
    requestPasswordReset,
    updatePassword,
  };
}

let unsubscribeAuth = null;
let unsubscribeAuthEvent = null;

function pushSessionToFrame() {
  if (!bridgeEnabled) return;
  try {
    const apply = frame.value?.contentWindow?.Aloop?.auth?.applySession;
    if (typeof apply === 'function') apply(account.value);
  } catch {
    // Cross-document access can fail while the frame is navigating; the next
    // load event pushes the session again.
  }
}

// Supabase consumes valid verification / recovery tokens from the URL itself.
// Only error parameters need reporting: the SDK leaves them untouched.
function consumeVerificationError() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  if (!raw || raw.startsWith('/')) return;
  const params = new URLSearchParams(raw);
  if (!params.get('error') && !params.get('error_code')) return;
  pendingAccountNotice = 'verify_failed';
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
}

function openAccountWithNotice(doc) {
  const notice = pendingAccountNotice;
  pendingAccountNotice = null;
  const modal = doc?.defaultView?.Aloop?.authModal;
  if (modal) modal.open({ notice });
  else doc?.getElementById?.('authOpen')?.click();
}

// Ask the legacy dialog to open with a notice (recovery link / failed link).
function requestAccountNotice(notice) {
  pendingAccountNotice = notice;
  const doc = frameDocument();
  if (doc?.defaultView?.Aloop?.authModal) {
    openAccountWithNotice(doc);
    return;
  }
  pendingAccountOpen = true;
  if (route.value !== 'home') navigate('home');
}

function openAccount() {
  const trigger = frameDocument()?.getElementById?.('authOpen');
  if (trigger) {
    trigger.click();
    return;
  }
  pendingAccountOpen = true;
  if (route.value !== 'home') navigate('home');
}

const aboutSrc = computed(() => `./说明.html?embed=1&lang=${language.value}`);

function frameDocument() {
  try {
    return frame.value?.contentDocument || null;
  } catch {
    return null;
  }
}

function documentLanguage(doc) {
  return (doc?.documentElement?.getAttribute('lang') || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
}

// The legacy runtime owns its own language control; click it only when the two
// sides disagree so a stored preference is never overwritten on load.
function syncLegacyLanguage() {
  const doc = frameDocument();
  const button = doc?.querySelector?.(`[data-lang-set="${language.value}"]`);
  if (!button) return;
  if (documentLanguage(doc) !== language.value) button.click();
}

let legacyWindow = null;

function onFrameLoad() {
  status.value = '';
  if (legacyWindow) legacyWindow.removeEventListener('hashchange', onLegacyHashChange);
  legacyWindow = null;
  const doc = frameDocument();
  // The About document and the legacy runtime are different documents; only the
  // legacy runtime reports hash navigation and needs the language click adapter.
  const isLegacyRuntime = Boolean(doc?.location?.pathname?.endsWith('/legacy.html'));
  if (isLegacyRuntime) {
    try {
      legacyWindow = frame.value?.contentWindow || null;
      legacyWindow?.addEventListener('hashchange', onLegacyHashChange);
    } catch {
      legacyWindow = null;
    }
    syncLegacyLanguage();
    pushSessionToFrame();
    if (pendingAccountNotice) {
      openAccountWithNotice(doc);
    } else if (pendingAccountOpen) {
      pendingAccountOpen = false;
      doc.getElementById('authOpen')?.click();
    }
  }
}

const shellHashes = {
  home: '#/',
  experiments: '#/e/believe',
  easysci: '#/easysci',
  'smart-brain': '#/smart-brain',
  about: '#/about',
};
const legacyHashes = {
  home: '#/',
  experiments: '#/e/believe',
  easysci: '#/easysci',
  'smart-brain': '#/smart-brain',
};

function targetFromHash(hash) {
  const parts = (hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'e') return 'experiments';
  if (parts[0] === 'smart-brain') return 'smart-brain';
  if (parts[0] === 'easysci') return 'easysci';
  const key = parts[0] || 'home';
  return Object.hasOwn(shellHashes, key) ? key : 'home';
}

function toggleMenu(name) {
  if (openMenu.value === name) {
    openMenu.value = null;
    return;
  }
  openMenu.value = name;
  nextTick(() => {
    const panel = name === 'experiments' ? experimentsPanel.value : productsPanel.value;
    panel?.querySelector('[role=menuitem]')?.focus({ preventScroll: true });
  });
}

function closeMenu(restoreFocus = false) {
  const name = openMenu.value;
  openMenu.value = null;
  if (!restoreFocus || !name) return;
  const trigger = name === 'experiments' ? experimentsTrigger.value : productsTrigger.value;
  trigger?.focus({ preventScroll: true });
}

function choose(target) {
  openMenu.value = null;
  navigate(target);
}

// Same interaction contract as assets/js/ui/quickmenu.js: outside click closes,
// Escape closes and restores focus, arrows cycle, Home/End jump.
function onMenuDocumentClick(event) {
  if (openMenu.value === 'experiments'
    && !experimentsPanel.value?.contains(event.target)
    && !experimentsTrigger.value?.contains(event.target)) openMenu.value = null;
  if (openMenu.value === 'products'
    && !productsPanel.value?.contains(event.target)
    && !productsTrigger.value?.contains(event.target)) openMenu.value = null;
}

function onMenuDocumentKeydown(event) {
  const name = openMenu.value;
  if (!name) return;
  const panel = name === 'experiments' ? experimentsPanel.value : productsPanel.value;
  if (!panel) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu(true);
    return;
  }
  const items = Array.from(panel.querySelectorAll('[role=menuitem]'));
  const current = items.indexOf(document.activeElement);
  if (items.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    items[(current + offset + items.length) % items.length]?.focus();
    return;
  }
  if (name === 'experiments') {
    if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus(); }
    return;
  }
  if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); items[0]?.focus(); }
}

function updateFrame(target, hash = window.location.hash) {
  if (target === 'about') {
    if (frameSrc.value !== aboutSrc.value) frameSrc.value = aboutSrc.value;
    return;
  }
  const fallback = legacyHashes[target] || '#/';
  const routeHash = target === 'experiments' && hash.startsWith('#/e/')
    ? hash
    : (target === 'smart-brain' && hash.startsWith('#/smart-brain')
      ? hash
      : (target === 'easysci' && hash.startsWith('#/easysci')
        ? hash
        : fallback));
  const src = `./legacy.html?embed=1${routeHash}`;
  if (frameSrc.value !== src) frameSrc.value = src;
}

function navigate(target) {
  if (!Object.hasOwn(shellHashes, target)) return;
  route.value = target;
  const nextHash = target === 'experiments' && window.location.hash.startsWith('#/e/')
    ? window.location.hash
    : shellHashes[target];
  updateFrame(target, nextHash);
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

function onShellHashChange() {
  openMenu.value = null;
  const target = targetFromHash(window.location.hash);
  route.value = target;
  updateFrame(target, window.location.hash);
}

function onLegacyHashChange() {
  try {
    if (!frame.value?.contentWindow?.location.pathname.endsWith('/legacy.html')) return;
    const target = targetFromHash(frame.value.contentWindow.location.hash);
    route.value = target;
    const legacyHash = frame.value.contentWindow.location.hash;
    const nextHash = legacyHash.startsWith('#/e/')
      ? legacyHash
      : (legacyHash.startsWith('#/smart-brain')
        ? legacyHash
        : (legacyHash.startsWith('#/easysci') ? legacyHash : shellHashes[target]));
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  } catch {
    // The shell remains usable if the embedded document is unavailable.
  }
}

function setLanguage(value) {
  language.value = value === 'en' ? 'en' : 'zh';
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language.value);
  } catch {
    // Non-persistent fallback: the current document still switches language.
  }
  if (route.value === 'about') {
    updateFrame('about');
    return;
  }
  syncLegacyLanguage();
}

onMounted(() => {
  consumeVerificationError();
  frame.value?.addEventListener('load', onFrameLoad);
  window.addEventListener('hashchange', onShellHashChange);
  document.addEventListener('click', onMenuDocumentClick);
  document.addEventListener('keydown', onMenuDocumentKeydown);
  const initialRoute = targetFromHash(window.location.hash);
  route.value = initialRoute;
  updateFrame(initialRoute);
  // Restore the Supabase session before the first iframe push, then keep the
  // embedded runtime in sync with every later sign-in / sign-out.
  unsubscribeAuth = bridgeEnabled ? subscribeAuth(() => pushSessionToFrame()) : null;
  unsubscribeAuthEvent = bridgeEnabled
    ? subscribeAuthEvent((event) => { if (event === 'PASSWORD_RECOVERY') requestAccountNotice('recovery'); })
    : null;
  initAuth()
    .catch((error) => console.warn('Supabase initialisation failed:', error?.message || error))
    .finally(() => pushSessionToFrame());
});
onBeforeUnmount(() => {
  frame.value?.removeEventListener('load', onFrameLoad);
  window.removeEventListener('hashchange', onShellHashChange);
  document.removeEventListener('click', onMenuDocumentClick);
  document.removeEventListener('keydown', onMenuDocumentKeydown);
  legacyWindow?.removeEventListener('hashchange', onLegacyHashChange);
  unsubscribeAuth?.();
  unsubscribeAuthEvent?.();
});
</script>

<template>
  <main class="app-shell">
    <header class="vue-topbar">
      <button class="vue-brand" type="button" data-shell-route="home" @click="navigate('home')" aria-label="Aloop home">
        <span class="vue-brand-mark" aria-hidden="true">A</span>
        <span>Aloop</span>
      </button>
      <nav class="vue-nav" aria-label="Primary navigation" data-testid="vue-shell-nav">
        <button type="button" data-shell-route="home" :aria-current="route === 'home' ? 'page' : undefined" @click="navigate('home')">{{ copy.home }}</button>
        <div class="vue-menu-wrap">
          <button
            ref="experimentsTrigger"
            type="button"
            data-shell-route="experiments"
            :aria-expanded="openMenu === 'experiments'"
            aria-haspopup="menu"
            aria-controls="shellExperimentsMenu"
            @click="toggleMenu('experiments')"
          >{{ copy.experiments }}<svg class="vue-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div ref="experimentsPanel" id="shellExperimentsMenu" class="vue-menu quick-menu" role="menu" aria-label="Experiments" :hidden="openMenu !== 'experiments'">
            <p class="panel-kicker">{{ copy.menuTitle }}</p>
            <button type="button" class="quick-menu-item" data-shell-experiment="believe" :aria-current="route === 'experiments' ? 'true' : undefined" role="menuitem" @click="choose('experiments')">
              <span class="menu-thumb"><svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#F2CC4D" stroke-width="1.35" stroke-linecap="round"><path d="M3 17 C10 11 15 23 23 17 S36 11 45 16M3 23 C10 17 15 29 23 23 S36 17 45 22M3 29 C10 23 15 35 23 29 S36 23 45 28M3 35 C10 29 15 41 23 35 S36 29 45 34"/><path d="M12 11v25M20 14v23M28 12v25M36 15v21" stroke-opacity=".45"/></g><g fill="#fff"><circle cx="14" cy="20" r="1"/><circle cx="31" cy="26" r="1"/><circle cx="38" cy="33" r="1"/></g></svg></span>
              <span class="menu-name">beLieve</span>
              <span class="menu-arrow" aria-hidden="true">↗</span>
            </button>
            <div class="menu-soon" aria-disabled="true"><span class="soon-dot" aria-hidden="true"></span><span>{{ copy.menuSoon }}</span></div>
          </div>
        </div>
        <div class="vue-menu-wrap">
          <button
            ref="productsTrigger"
            type="button"
            data-shell-route="products"
            :aria-expanded="openMenu === 'products'"
            aria-haspopup="menu"
            aria-controls="shellProductsMenu"
            @click="toggleMenu('products')"
          >{{ copy.products }}<svg class="vue-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div ref="productsPanel" id="shellProductsMenu" class="vue-menu products-menu" role="menu" aria-label="Products" :hidden="openMenu !== 'products'">
            <p class="panel-kicker">{{ copy.productsTitle }}</p>
            <button type="button" class="products-menu-item" data-shell-route="easysci" :aria-current="route === 'easysci' ? 'true' : undefined" role="menuitem" @click="choose('easysci')">
              <span class="products-menu-mark" aria-hidden="true">ES</span>
              <span class="products-menu-copy"><span class="products-menu-name">{{ copy.easysci }}</span><span class="products-menu-description">{{ copy.easysciDesc }}</span></span>
              <span class="menu-arrow" aria-hidden="true">↗</span>
            </button>
            <button type="button" class="products-menu-item" data-shell-route="smart-brain" :aria-current="route === 'smart-brain' ? 'true' : undefined" role="menuitem" @click="choose('smart-brain')">
              <span class="products-menu-mark" aria-hidden="true">SB</span>
              <span class="products-menu-copy"><span class="products-menu-name">{{ copy.brain }}</span><span class="products-menu-description">{{ copy.brainDesc }}</span></span>
              <span class="menu-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
        <button type="button" data-shell-route="about" :aria-current="route === 'about' ? 'page' : undefined" @click="navigate('about')">{{ copy.about }}</button>
      </nav>
      <div class="vue-topbar-actions">
        <button class="vue-auth" type="button" data-shell-account @click="openAccount">{{ accountText }}</button>
        <span class="vue-topbar-divider" aria-hidden="true"></span>
        <div class="vue-language" role="group" :aria-label="copy.language">
          <button type="button" data-shell-language="zh" lang="zh-CN" :aria-pressed="language === 'zh'" @click="setLanguage('zh')">中</button>
          <button type="button" data-shell-language="en" lang="en" :aria-pressed="language === 'en'" @click="setLanguage('en')">EN</button>
        </div>
      </div>
    </header>
    <p v-if="configWarning" class="auth-config-warning" role="alert">{{ configWarning.message }}</p>
    <section class="legacy-frame-wrap" aria-label="Aloop research content">
      <iframe
        ref="frame"
        class="legacy-runtime"
        :src="frameSrc || undefined"
        title="Aloop legacy research environment"
        allow="fullscreen"
      />
      <p v-if="status" class="loading-status" role="status">{{ copy.loading }}</p>
    </section>
  </main>
</template>
