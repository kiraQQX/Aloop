<script setup>
import { computed, ref, watch } from 'vue';
import { useSparkStore } from './sparkStore';
import { sparkText } from './sparkCopy';
import { STYLE_PRESETS, svgToDataUrl } from '../../lib/spark/generationAdapter';
import { describeProvenance } from '../../lib/spark/bciAdapter';

const props = defineProps({
  language: { type: String, default: 'zh' },
  canSync: { type: Boolean, default: false },
  signedIn: { type: Boolean, default: false },
  cloudConfigured: { type: Boolean, default: false },
});
const emit = defineEmits(['regenerate', 'open-library']);

const store = useSparkStore();
const result = computed(() => store.state.result);
const t = computed(() => sparkText(props.language));
const savedIdea = computed(() => (result.value?.savedIdeaId ? store.getIdea(result.value.savedIdeaId) : null));
const imageSrc = computed(() => {
  const r = result.value;
  if (!r) return '';
  if (r.imageSvg) return svgToDataUrl(r.imageSvg);
  return r.imageUrl || '';
});
const tagsText = ref('');
watch(result, (value) => { tagsText.value = (value?.tags || []).join(', '); }, { immediate: true });

function onTags(event) {
  tagsText.value = event.target.value;
  const tags = tagsText.value.split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean);
  store.updateResult({ tags });
}
function onField(key, event) { store.updateResult({ [key]: event.target.value }); }
function onStyle(event) {
  store.setDraft({ style: event.target.value });
}
const syncMessage = ref('');
async function sync() {
  if (!savedIdea.value) store.saveResult();
  const outcome = await store.syncIdea(result.value.savedIdeaId);
  syncMessage.value = outcome.ok ? '' : `${t.value.syncFailed}${outcome.message}`;
}
function save() { store.saveResult(); }
</script>

<template>
  <div v-if="result" class="spark-result" data-testid="spark-result">
    <p class="spark-kicker">{{ t.resultKicker }}</p>

    <figure class="spark-visual">
      <img v-if="imageSrc" :src="imageSrc" :alt="result.description || result.title" data-testid="spark-visual" />
      <figcaption>
        <span class="spark-badge" :data-provenance="result.provenance" data-testid="spark-provenance">{{ t.provenance }}: {{ describeProvenance(result.provenance, language) }}</span>
      </figcaption>
    </figure>
    <p class="spark-note" data-testid="spark-provenance-note">{{ result.provenance === 'ai' ? t.aiNotice : t.demoNotice }}</p>

    <label class="spark-fragment"><span>{{ t.resultTitle }}</span>
      <input class="spark-input" type="text" maxlength="200" data-testid="spark-title" :value="result.title" @input="onField('title', $event)" />
    </label>
    <label class="spark-fragment"><span>{{ t.resultDescription }}</span>
      <textarea class="spark-input spark-textarea" rows="3" data-testid="spark-description" :value="result.description" @input="onField('description', $event)"></textarea>
    </label>
    <div class="spark-fragment"><span>{{ t.resultComposition }}</span>
      <p class="spark-composition">{{ result.composition }}</p>
      <ul v-if="result.palette?.length" class="spark-palette" aria-hidden="true"><li v-for="color in result.palette" :key="color" :style="{ background: color }"></li></ul>
    </div>
    <label class="spark-fragment"><span>{{ t.resultTags }}</span>
      <input class="spark-input" type="text" data-testid="spark-tags" :value="tagsText" @input="onTags" />
    </label>
    <label class="spark-fragment"><span>{{ t.resultPrompt }}</span>
      <textarea class="spark-input spark-textarea" rows="4" data-testid="spark-prompt" :value="result.prompt" @input="onField('prompt', $event)"></textarea>
    </label>
    <label class="spark-fragment"><span>{{ t.styleLabel }}</span>
      <select class="spark-input" data-testid="spark-result-style" :value="store.state.draft.style" @change="onStyle">
        <option v-for="preset in STYLE_PRESETS" :key="preset.id" :value="preset.id">{{ language === 'en' ? preset.en : preset.zh }}</option>
      </select>
    </label>

    <div class="spark-actions">
      <button type="button" class="spark-btn spark-btn-primary" data-testid="spark-save" @click="save">{{ t.save }}</button>
      <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-regenerate" @click="emit('regenerate')">{{ t.regenerate }}</button>
      <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-edit-inputs" @click="store.editInputs()">{{ t.editInputs }}</button>
      <button type="button" class="spark-link" data-testid="spark-new" @click="store.newSpark()">{{ t.newSpark }}</button>
    </div>

    <p v-if="savedIdea" class="spark-note spark-saved" role="status" data-testid="spark-saved">
      {{ savedIdea.syncState === 'synced' ? t.syncedBadge : t.saved }}
      <button type="button" class="spark-link" @click="emit('open-library')">{{ t.openLibrary }}</button>
    </p>
    <div class="spark-sync">
      <button v-if="canSync" type="button" class="spark-btn spark-btn-ghost" data-testid="spark-sync" :disabled="savedIdea?.syncing" @click="sync">{{ t.syncCloud }}</button>
      <p v-else-if="!signedIn" class="spark-note" data-testid="spark-sync-note">{{ t.syncSigned }}</p>
      <p v-else-if="!cloudConfigured" class="spark-note" data-testid="spark-sync-note">{{ t.syncUnconfigured }}</p>
      <p v-if="syncMessage" class="spark-alert" role="alert">{{ syncMessage }}</p>
    </div>
  </div>
</template>
