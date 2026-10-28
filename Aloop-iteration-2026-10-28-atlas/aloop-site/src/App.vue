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

function onFrameLoad() {
  status.value = '';
  syncLegacyLanguage();
}

function navigate(target) {
  route.value = target;
  if (target === 'about') {
    frame.value.src = './说明.html';
    return;
  }
  const hashes = {
    home: '#/',
    experiments: '#/',
    easysci: '#/easysci',
    'smart-brain': '#/smart-brain',
  };
  frame.value.src = `./legacy.html?embed=1${hashes[target] || '#/'}`;
}

function setLanguage(value) {
  language.value = value;
  syncLegacyLanguage();
}

onMounted(() => {
  frame.value?.addEventListener('load', onFrameLoad);
});
onBeforeUnmount(() => {
  frame.value?.removeEventListener('load', onFrameLoad);
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
