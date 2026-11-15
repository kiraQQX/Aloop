<script setup>
import { computed, reactive, ref } from 'vue';
import { IMAGERY_DIMENSIONS, useSparkStore } from './sparkStore';
import { sparkText } from './sparkCopy';

const props = defineProps({ language: { type: String, default: 'zh' } });
const emit = defineEmits(['done']);

const store = useSparkStore();
const t = computed(() => sparkText(props.language));
const values = reactive(Object.fromEntries(IMAGERY_DIMENSIONS.map((key) => [key, store.state.profile?.dims?.[key] ?? 3])));
const message = ref('');

function save() {
  store.saveProfile(values);
  message.value = t.value.calibrateSaved;
}
function skip() {
  store.skipCalibration();
  message.value = t.value.calibrateSkipped;
  emit('done');
}
function reset() {
  store.clearProfile();
  for (const key of IMAGERY_DIMENSIONS) values[key] = 3;
  message.value = '';
}
</script>

<template>
  <div class="spark-calibration" data-testid="spark-calibration">
    <h2 class="spark-h2">{{ t.calibrateTitle }}</h2>
    <p class="spark-hint">{{ t.calibrateIntro }}</p>
    <p class="spark-note spark-disclaimer" data-testid="spark-calibration-disclaimer">{{ t.calibrateDisclaimer }}</p>

    <ul class="spark-dims">
      <li v-for="key in IMAGERY_DIMENSIONS" :key="key" class="spark-dim">
        <label :for="`spark-dim-${key}`">
          <span class="spark-dim-name">{{ t.dims[key][0] }}</span>
          <span class="spark-dim-desc">{{ t.dims[key][1] }}</span>
        </label>
        <div class="spark-dim-control">
          <span class="spark-dim-end">{{ t.scaleNone }}</span>
          <input :id="`spark-dim-${key}`" v-model.number="values[key]" type="range" min="0" max="5" step="1" :data-testid="`spark-dim-${key}`" />
          <span class="spark-dim-end">{{ t.scaleVivid }}</span>
          <output class="spark-dim-value" :for="`spark-dim-${key}`">{{ values[key] }}</output>
        </div>
      </li>
    </ul>

    <p class="spark-note" data-testid="spark-profile-state">
      {{ t.profileSummary }}: {{ store.state.profile?.dims ? IMAGERY_DIMENSIONS.map((key) => `${t.dims[key][0]} ${store.state.profile.dims[key]}`).join(' · ') : t.profileNone }}
    </p>
    <p v-if="message" class="spark-note" role="status">{{ message }}</p>

    <div class="spark-actions">
      <button type="button" class="spark-btn spark-btn-primary" data-testid="spark-calibrate-save" @click="save">{{ t.calibrateSave }}</button>
      <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-calibrate-skip" @click="skip">{{ t.calibrateSkip }}</button>
      <button type="button" class="spark-link spark-link-danger" data-testid="spark-calibrate-reset" @click="reset">{{ t.calibrateReset }}</button>
    </div>
  </div>
</template>
