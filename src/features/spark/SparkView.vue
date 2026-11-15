<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SparkVisualizer from './SparkVisualizer.vue';
import SparkCapture from './SparkCapture.vue';
import SparkResult from './SparkResult.vue';
import SparkLibrary from './SparkLibrary.vue';
import SparkCalibration from './SparkCalibration.vue';
import { useSparkStore } from './sparkStore';
import { sparkText } from './sparkCopy';
import { createBciAdapter } from '../../lib/spark/bciAdapter';
import './spark.css';

const props = defineProps({
  language: { type: String, default: 'zh' },
  sub: { type: String, default: 'capture' },
  user: { type: Object, default: null },
  cloudConfigured: { type: Boolean, default: false },
});
const emit = defineEmits(['navigate']);

const store = useSparkStore();
const state = store.state;
const t = computed(() => sparkText(props.language));
const sub = computed(() => (['library', 'calibrate'].includes(props.sub) ? props.sub : 'capture'));

// ---- BCI (simulated by default) ----
const bci = createBciAdapter('mock');
const drive = ref(0.25);
const bciError = ref('');
const unsubscribeBci = bci.subscribe((frame) => {
  if (frame.type === 'status') return;
  drive.value = frame.drive;
});
async function startBci() {
  try {
    await bci.connect();
    await bci.start();
    bciError.value = '';
  } catch (error) {
    bciError.value = error?.message || 'BCI adapter failed.';
  }
}
async function stopBci() {
  try { await bci.stop(); } catch { /* already stopped */ }
}
watch(() => state.phase, (phase) => {
  if (['guide', 'capture', 'reconstructing'].includes(phase)) startBci();
  else stopBci();
}, { immediate: true });

// ---- account / cloud ----
watch(() => props.cloudConfigured, (value) => store.setCloud({ configured: value }), { immediate: true });
watch(() => props.user, (user) => {
  store.setUser(user);
  if (user && store.canSync) store.loadCloud();
}, { immediate: true });
const signedIn = computed(() => Boolean(props.user));
const canSync = computed(() => Boolean(props.user) && props.cloudConfigured);

// ---- motion ----
const pulseKey = ref(0);
const running = ref(false);
let reducedQuery = null;
function onReducedChange(event) { store.setReducedMotion(event.matches); }
onMounted(() => {
  try {
    reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    store.setReducedMotion(reducedQuery.matches);
    reducedQuery.addEventListener?.('change', onReducedChange);
  } catch { /* matchMedia unavailable */ }
});
onBeforeUnmount(() => {
  reducedQuery?.removeEventListener?.('change', onReducedChange);
  unsubscribeBci();
  bci.disconnect();
  store.cancelGeneration();
});
const motionMode = computed(() => (state.motion.reduced ? 'reduced' : (state.motion.paused ? 'paused' : 'running')));

// ---- flow ----
const fieldPhase = computed(() => (sub.value === 'capture' ? state.phase : 'result'));
const statusText = computed(() => ({
  idle: t.value.statusIdle,
  guide: t.value.statusGuide,
  capture: t.value.statusCapture,
  reconstructing: t.value.statusReconstructing,
  result: t.value.statusResult,
}[state.phase]));
const errorText = computed(() => {
  const error = state.error;
  if (!error) return '';
  return t.value.generationErrors[error.code] || error.message || t.value.generationErrors.generation_failed;
});

async function generate() {
  pulseKey.value += 1;
  await store.generate({ language: props.language });
}
function go(target) { emit('navigate', target); }

const tabs = computed(() => [
  { id: 'capture', label: t.value.navCapture },
  { id: 'library', label: `${t.value.navLibrary} · ${state.ideas.length}` },
  { id: 'calibrate', label: t.value.navCalibrate },
]);
</script>

<template>
  <section
    class="spark-root"
    :class="[`spark-sub-${sub}`, `spark-phase-${state.phase}`]"
    data-testid="spark-view"
    :data-phase="state.phase"
    :data-sub="sub"
    :data-motion="motionMode"
    :lang="language === 'en' ? 'en' : 'zh-CN'"
    :aria-label="t.product"
  >
    <div class="spark-main">
      <div class="spark-stage">
        <SparkVisualizer
          :phase="fieldPhase"
          :drive="drive"
          :paused="state.motion.paused"
          :reduced="state.motion.reduced"
          :speed="state.motion.speed"
          :pulse-key="pulseKey"
          :label="t.fieldLabel"
          @visibility="(visible) => store.setHidden(!visible)"
          @running="(value) => { running = value; }"
        />

        <div class="spark-hud">
          <p class="spark-chip spark-chip-sim" data-testid="spark-sim-mode">{{ t.simMode }}</p>
          <p class="spark-signal" data-testid="spark-sim-signal"><strong>{{ t.simSignal }}</strong><span>{{ t.simDetail }}</span></p>
        </div>

        <div v-if="sub === 'capture' && state.phase === 'idle'" class="spark-hero" data-testid="spark-hero">
          <p class="spark-kicker">{{ t.kicker }}</p>
          <h1 class="spark-title">{{ t.product }}</h1>
          <p class="spark-tagline-en">{{ t.taglineEn }}</p>
          <p class="spark-tagline">{{ t.taglineLocal }}</p>
          <p class="spark-slogan">{{ t.slogan }}</p>
        </div>

        <div class="spark-motion" role="group" :aria-label="t.speed">
          <button type="button" class="spark-btn spark-btn-ghost spark-btn-small" data-testid="spark-pause" :aria-pressed="state.motion.paused" :disabled="state.motion.reduced" @click="store.togglePause()">
            {{ state.motion.paused ? t.resume : t.pause }}
          </button>
          <label class="spark-speed">
            <span class="spark-sr">{{ t.speed }}</span>
            <select class="spark-input spark-input-small" data-testid="spark-speed" :value="state.motion.speed" :disabled="state.motion.reduced" @change="store.setSpeed($event.target.value)">
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="1.5">1.5×</option>
            </select>
          </label>
          <span v-if="state.motion.reduced" class="spark-note spark-reduced" data-testid="spark-reduced-note">{{ t.reducedNote }}</span>
        </div>
      </div>

      <aside class="spark-dock">
        <nav class="spark-tabs" :aria-label="t.tabsLabel">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="spark-tab"
            :data-testid="`spark-tab-${tab.id}`"
            :aria-current="sub === tab.id ? 'page' : undefined"
            @click="go(tab.id)"
          >{{ tab.label }}</button>
        </nav>

        <p class="spark-sr" role="status" aria-live="polite" data-testid="spark-status">{{ statusText }}</p>

        <template v-if="sub === 'capture'">
          <div v-if="state.phase === 'idle'" class="spark-start" data-testid="spark-start-panel">
            <button type="button" class="spark-btn spark-btn-primary spark-btn-large" data-testid="spark-capture-start" @click="store.start()">
              {{ t.cta }}<span v-if="language === 'zh'" class="spark-btn-sub"> · {{ t.ctaEn }}</span>
            </button>
            <p class="spark-note">{{ t.simExplain }}</p>
            <p class="spark-note" data-testid="spark-generation-mode">{{ store.generationMode === 'demo' ? t.genDemo : t.genRemote }}</p>
            <h2 class="spark-h3">{{ t.privacyTitle }}</h2>
            <ul class="spark-privacy"><li v-for="line in t.privacy" :key="line">{{ line }}</li></ul>
          </div>

          <SparkCapture v-else-if="state.phase === 'guide' || state.phase === 'capture'" :phase="state.phase" :language="language" @submit="generate" />

          <div v-else-if="state.phase === 'reconstructing'" class="spark-working" data-testid="spark-working">
            <p class="spark-kicker">{{ t.reconstructingTitle }}</p>
            <p class="spark-hint">{{ t.reconstructingNote }}</p>
            <div class="spark-countdown-bar spark-indeterminate" aria-hidden="true"><span></span></div>
            <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-cancel-generation" @click="store.cancelGeneration()">{{ t.cancelGeneration }}</button>
          </div>

          <SparkResult
            v-else-if="state.phase === 'result'"
            :language="language"
            :can-sync="canSync"
            :signed-in="signedIn"
            :cloud-configured="cloudConfigured"
            @regenerate="generate"
            @open-library="go('library')"
          />

          <p v-if="errorText" class="spark-alert" role="alert" data-testid="spark-error"><strong>{{ t.errorTitle }}:</strong> {{ errorText }}</p>
          <p v-if="bciError" class="spark-alert" role="alert" data-testid="spark-bci-error">{{ bciError }}</p>
        </template>

        <SparkLibrary
          v-else-if="sub === 'library'"
          :language="language"
          :can-sync="canSync"
          :signed-in="signedIn"
          @open="go('capture')"
          @regenerate="() => { go('capture'); generate(); }"
        />

        <SparkCalibration v-else :language="language" @done="go('capture')" />
      </aside>
    </div>
  </section>
</template>
