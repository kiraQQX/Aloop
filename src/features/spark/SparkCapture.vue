<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useSparkStore } from './sparkStore';
import { sparkText } from './sparkCopy';
import { STYLE_PRESETS, fragmentLabel } from '../../lib/spark/generationAdapter';
import { COUNTDOWN_SECONDS, FRAGMENT_KEYS, VoiceCapture, createCountdown, getSpeechSupport, readReferenceImage } from '../../lib/spark/captureService';

const props = defineProps({
  language: { type: String, default: 'zh' },
  phase: { type: String, default: 'capture' },
});
const emit = defineEmits(['submit']);

const store = useSparkStore();
const draft = store.state.draft;
const t = computed(() => sparkText(props.language));

// ---- guided imagery hold ----
const remaining = ref(COUNTDOWN_SECONDS);
let countdown = null;
function stopCountdown() { countdown?.cancel(); countdown = null; }
function finishGuide() {
  stopCountdown();
  store.beginCapture();
}
watch(() => props.phase, (phase) => {
  stopCountdown();
  if (phase === 'guide') {
    countdown = createCountdown({ onTick: (value) => { remaining.value = value; }, onDone: finishGuide });
    countdown.start();
  }
}, { immediate: true });

// ---- voice ----
const textarea = ref(null);
const voiceState = ref('idle');
const voiceError = ref('');
const support = getSpeechSupport();
let voice = null;
let voiceBase = '';

function startVoice() {
  voiceError.value = '';
  voiceBase = draft.text ? `${draft.text.trim()} ` : '';
  voice = new VoiceCapture({
    lang: props.language === 'en' ? 'en-US' : 'zh-CN',
    onTranscript: (text) => store.setDraft({ text: `${voiceBase}${text}`, voiceUsed: true }),
    onState: (state) => { voiceState.value = state; },
    onError: (error) => {
      voiceError.value = t.value.voiceErrors[error.code] || t.value.voiceErrors.recognition_failed;
      nextTick(() => textarea.value?.focus());
    },
  });
  voice.start();
}
function toggleVoice() {
  if (voiceState.value === 'listening') voice?.stop();
  else startVoice();
}

// ---- reference image ----
const imagePreview = ref('');
const imageError = ref('');
async function onImage(event) {
  imageError.value = '';
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const image = await readReferenceImage(file);
    imagePreview.value = image.dataUrl;
    store.setDraft({ imageName: image.name });
  } catch (error) {
    imagePreview.value = '';
    store.setDraft({ imageName: '' });
    imageError.value = t.value.imageErrors[error.code] || t.value.imageErrors.read_failed;
  } finally {
    event.target.value = '';
  }
}
function removeImage() {
  imagePreview.value = '';
  imageError.value = '';
  store.setDraft({ imageName: '' });
}

function onText(event) { store.setDraft({ text: event.target.value }); }
function onFragment(key, event) { store.setDraft({ fragments: { [key]: event.target.value } }); }
function onStyle(event) { store.setDraft({ style: event.target.value }); }

const canSubmit = computed(() => store.canSubmit());
function submit() {
  if (!canSubmit.value) return;
  voice?.cancel();
  emit('submit');
}
function cancel() {
  voice?.cancel();
  store.cancelCapture();
}

onBeforeUnmount(() => {
  stopCountdown();
  voice?.cancel();
});
</script>

<template>
  <div class="spark-capture">
    <div v-if="phase === 'guide'" class="spark-guide" data-testid="spark-guide">
      <p class="spark-kicker">{{ t.guideKicker }}</p>
      <p class="spark-guide-text">{{ t.guideText }}</p>
      <div class="spark-countdown" role="timer" aria-live="off">
        <span class="spark-countdown-num" data-testid="spark-countdown">{{ remaining }}</span>
        <span class="spark-countdown-label">{{ t.guideRemaining }}</span>
      </div>
      <div class="spark-countdown-bar" aria-hidden="true"><span :style="{ width: `${(remaining / COUNTDOWN_SECONDS) * 100}%` }"></span></div>
      <button type="button" class="spark-btn spark-btn-primary" data-testid="spark-guide-skip" @click="finishGuide">{{ t.guideSkip }}</button>
      <button type="button" class="spark-link" @click="cancel">{{ t.cancel }}</button>
    </div>

    <div v-else class="spark-form" data-testid="spark-form">
      <p class="spark-kicker">{{ t.captureKicker }}</p>
      <p class="spark-hint">{{ t.captureHint }}</p>

      <label class="spark-field-label" for="spark-text">{{ t.textLabel }}</label>
      <textarea
        id="spark-text"
        ref="textarea"
        class="spark-input spark-textarea"
        data-testid="spark-text"
        rows="4"
        maxlength="4000"
        :placeholder="t.textPlaceholder"
        :value="draft.text"
        @input="onText"
      ></textarea>

      <div class="spark-voice">
        <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-voice" :aria-pressed="voiceState === 'listening'" @click="toggleVoice">
          {{ voiceState === 'listening' ? t.voiceStop : t.voiceStart }}
        </button>
        <span v-if="voiceState === 'listening'" class="spark-voice-live" role="status">{{ t.voiceListening }}</span>
        <p v-if="!support.recognition" class="spark-note" data-testid="spark-voice-unsupported">{{ t.voiceErrors.unsupported }}</p>
        <p v-else class="spark-note">{{ t.voiceNotice }}</p>
        <p v-if="voiceError" class="spark-alert" role="alert" data-testid="spark-voice-error">{{ voiceError }}</p>
      </div>

      <details class="spark-details">
        <summary data-testid="spark-fragments-toggle">{{ t.fragmentsTitle }}</summary>
        <div class="spark-fragments">
          <label v-for="key in FRAGMENT_KEYS" :key="key" class="spark-fragment">
            <span>{{ fragmentLabel(key, language) }}</span>
            <input class="spark-input" type="text" maxlength="500" :data-testid="`spark-fragment-${key}`" :value="draft.fragments[key] || ''" @input="onFragment(key, $event)" />
          </label>
        </div>
      </details>

      <div class="spark-image">
        <span class="spark-field-label">{{ t.imageTitle }}</span>
        <div class="spark-image-row">
          <label class="spark-btn spark-btn-ghost spark-file">
            {{ t.imageChoose }}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-testid="spark-image" @change="onImage" />
          </label>
          <button v-if="draft.imageName" type="button" class="spark-link" @click="removeImage">{{ t.imageRemove }}</button>
        </div>
        <div v-if="draft.imageName" class="spark-image-preview">
          <img v-if="imagePreview" :src="imagePreview" alt="" />
          <span>{{ draft.imageName }}</span>
        </div>
        <p class="spark-note">{{ t.imageNote }}</p>
        <p v-if="imageError" class="spark-alert" role="alert" data-testid="spark-image-error">{{ imageError }}</p>
      </div>

      <label class="spark-fragment">
        <span>{{ t.styleLabel }}</span>
        <select class="spark-input" data-testid="spark-style" :value="draft.style" @change="onStyle">
          <option v-for="preset in STYLE_PRESETS" :key="preset.id" :value="preset.id">{{ language === 'en' ? preset.en : preset.zh }}</option>
        </select>
      </label>

      <div class="spark-actions">
        <button type="button" class="spark-btn spark-btn-primary" data-testid="spark-submit" :disabled="!canSubmit" @click="submit">{{ t.submit }}</button>
        <button type="button" class="spark-link" data-testid="spark-cancel" @click="cancel">{{ t.cancel }}</button>
      </div>
      <p v-if="!canSubmit" class="spark-note">{{ t.submitNeedsCue }}</p>
    </div>
  </div>
</template>
