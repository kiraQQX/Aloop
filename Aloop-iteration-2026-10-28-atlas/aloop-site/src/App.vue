<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';

// Shared with the legacy runtime (assets/i18n/site.js) so the shell and the
// embedded documents always agree on the active language.
const LANGUAGE_KEY = 'aloop_lang_v1';
const frame = ref(null);
const frameSrc = ref('');
const status = ref('正在加载原有实验环境…');
const language = ref(readStoredLanguage());
const route = ref('home');
const experimentsMenuOpen = ref(false);

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
  ? { home: '首页', experiments: '实验', easysci: 'EasySci', brain: 'Smart Brain', about: '说明', account: '登录 / 注册', loading: '正在加载原有实验环境…', language: '语言切换' }
  : { home: 'Home', experiments: 'Experiments', easysci: 'EasySci', brain: 'Smart Brain', about: 'About', account: 'Log in / Sign up', loading: 'Loading the existing research environment…', language: 'Language' });

// The account UI lives inside the legacy runtime; the shell button forwards to
// it so the embedded document stays the single source of authentication state.
let pendingAccountOpen = false;

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
    if (pendingAccountOpen) {
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

function toggleExperimentsMenu() {
  experimentsMenuOpen.value = !experimentsMenuOpen.value;
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
  frame.value?.addEventListener('load', onFrameLoad);
  window.addEventListener('hashchange', onShellHashChange);
  const initialRoute = targetFromHash(window.location.hash);
  route.value = initialRoute;
  updateFrame(initialRoute);
});
onBeforeUnmount(() => {
  frame.value?.removeEventListener('load', onFrameLoad);
  window.removeEventListener('hashchange', onShellHashChange);
  legacyWindow?.removeEventListener('hashchange', onLegacyHashChange);
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
        <button type="button" data-shell-route="experiments" :aria-current="route === 'experiments' ? 'page' : undefined" :aria-expanded="experimentsMenuOpen" aria-haspopup="menu" @click="toggleExperimentsMenu">{{ copy.experiments }}</button>
        <div v-if="experimentsMenuOpen" class="vue-experiment-menu" role="menu" aria-label="Experiments">
          <button type="button" data-shell-experiment="believe" role="menuitem" @click="experimentsMenuOpen = false; navigate('experiments')">beLieve</button>
        </div>
        <button type="button" data-shell-route="easysci" :aria-current="route === 'easysci' ? 'page' : undefined" @click="navigate('easysci')">{{ copy.easysci }}</button>
        <button type="button" data-shell-route="smart-brain" :aria-current="route === 'smart-brain' ? 'page' : undefined" @click="navigate('smart-brain')">{{ copy.brain }}</button>
        <button type="button" data-shell-route="about" :aria-current="route === 'about' ? 'page' : undefined" @click="navigate('about')">{{ copy.about }}</button>
      </nav>
      <div class="vue-topbar-actions">
        <button class="vue-auth" type="button" data-shell-account @click="openAccount">{{ copy.account }}</button>
        <span class="vue-topbar-divider" aria-hidden="true"></span>
        <div class="vue-language" role="group" :aria-label="copy.language">
          <button type="button" data-shell-language="zh" lang="zh-CN" :aria-pressed="language === 'zh'" @click="setLanguage('zh')">中</button>
          <button type="button" data-shell-language="en" lang="en" :aria-pressed="language === 'en'" @click="setLanguage('en')">EN</button>
        </div>
      </div>
    </header>
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
