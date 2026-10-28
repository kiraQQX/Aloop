<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';

const frame = ref(null);
const status = ref('正在加载原有实验环境…');
const language = ref('zh');
const route = ref('home');

const copy = computed(() => language.value === 'zh'
  ? { home: '首页', experiments: '实验', easysci: 'EasySci', brain: 'Smart Brain', about: '说明', loading: '正在加载原有实验环境…', language: '语言切换' }
  : { home: 'Home', experiments: 'Experiments', easysci: 'EasySci', brain: 'Smart Brain', about: 'About', loading: 'Loading the existing research environment…', language: 'Language' });

function syncLegacyLanguage() {
  const doc = frame.value?.contentDocument;
  if (!doc) return;
  const button = doc.querySelector(`[data-lang-set="${language.value}"]`);
  button?.click();
}

let legacyWindow = null;

function onFrameLoad() {
  status.value = '';
  if (legacyWindow) legacyWindow.removeEventListener('hashchange', onLegacyHashChange);
  try {
    legacyWindow = frame.value?.contentWindow || null;
    legacyWindow?.addEventListener('hashchange', onLegacyHashChange);
  } catch {
    legacyWindow = null;
  }
  syncLegacyLanguage();
}

const shellHashes = {
  home: '#/',
  experiments: '#/experiments',
  easysci: '#/easysci',
  'smart-brain': '#/smart-brain',
  about: '#/about',
};
const legacyHashes = {
  home: '#/',
  experiments: '#/',
  easysci: '#/easysci',
  'smart-brain': '#/smart-brain',
};

function targetFromHash(hash) {
  const key = (hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean)[0] || 'home';
  return Object.hasOwn(shellHashes, key) ? key : 'home';
}

function updateFrame(target) {
  if (!frame.value) return;
  if (target === 'about') {
    if (!frame.value.getAttribute('src')?.endsWith('./说明.html')) frame.value.src = './说明.html';
    return;
  }
  const src = `./legacy.html?embed=1${legacyHashes[target] || '#/'}`;
  if (frame.value.getAttribute('src') !== src) frame.value.src = src;
}

function navigate(target) {
  if (!Object.hasOwn(shellHashes, target)) return;
  route.value = target;
  updateFrame(target);
  if (window.location.hash !== shellHashes[target]) window.location.hash = shellHashes[target];
}

function onShellHashChange() {
  const target = targetFromHash(window.location.hash);
  route.value = target;
  updateFrame(target);
}

function onLegacyHashChange() {
  try {
    if (!frame.value?.contentWindow?.location.pathname.endsWith('/legacy.html')) return;
    const target = targetFromHash(frame.value.contentWindow.location.hash);
    route.value = target;
    if (window.location.hash !== shellHashes[target]) window.location.hash = shellHashes[target];
  } catch {
    // The shell remains usable if the embedded document is unavailable.
  }
}

function setLanguage(value) {
  language.value = value;
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
        <button type="button" data-shell-route="experiments" :aria-current="route === 'experiments' ? 'page' : undefined" @click="navigate('experiments')">{{ copy.experiments }}</button>
        <button type="button" data-shell-route="easysci" :aria-current="route === 'easysci' ? 'page' : undefined" @click="navigate('easysci')">{{ copy.easysci }}</button>
        <button type="button" data-shell-route="smart-brain" :aria-current="route === 'smart-brain' ? 'page' : undefined" @click="navigate('smart-brain')">{{ copy.brain }}</button>
        <button type="button" data-shell-route="about" :aria-current="route === 'about' ? 'page' : undefined" @click="navigate('about')">{{ copy.about }}</button>
      </nav>
      <div class="vue-language" role="group" :aria-label="copy.language">
        <button type="button" data-shell-language="zh" lang="zh-CN" :aria-pressed="language === 'zh'" @click="setLanguage('zh')">中</button>
        <button type="button" data-shell-language="en" lang="en" :aria-pressed="language === 'en'" @click="setLanguage('en')">EN</button>
      </div>
    </header>
    <section class="legacy-frame-wrap" aria-label="Aloop research content">
      <iframe
        ref="frame"
        class="legacy-runtime"
        src="./legacy.html?embed=1"
        title="Aloop legacy research environment"
        allow="fullscreen"
      />
      <p v-if="status" class="loading-status" role="status">{{ copy.loading }}</p>
    </section>
  </main>
</template>
