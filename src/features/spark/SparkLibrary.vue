<script setup>
import { computed, onMounted, ref } from 'vue';
import { useSparkStore } from './sparkStore';
import { sparkText } from './sparkCopy';
import { svgToDataUrl } from '../../lib/spark/generationAdapter';

const props = defineProps({
  language: { type: String, default: 'zh' },
  canSync: { type: Boolean, default: false },
  signedIn: { type: Boolean, default: false },
});
const emit = defineEmits(['open', 'regenerate']);

const store = useSparkStore();
const t = computed(() => sparkText(props.language));
const query = ref('');
const tag = ref('');
const mode = ref('');
const sync = ref('');
const editingId = ref(null);
const editForm = ref({ title: '', tags: '', prompt: '' });
const notice = ref('');
const noticeKind = ref('status');

const ideas = computed(() => store.listIdeas({ query: query.value, tag: tag.value, mode: mode.value, sync: sync.value }));
const tags = computed(() => store.allTags());

function imageFor(idea) {
  if (idea.visualSvg) return svgToDataUrl(idea.visualSvg);
  return idea.imageUrl || idea.assetUrl || '';
}
function badge(idea) {
  if (idea.syncing) return { key: 'syncing', text: t.value.syncingBadge };
  switch (idea.syncState) {
    case 'synced': return { key: 'synced', text: t.value.syncedBadge };
    case 'dirty': return { key: 'dirty', text: t.value.dirtyBadge };
    case 'error': return { key: 'error', text: t.value.errorBadge };
    default: return { key: 'local', text: t.value.localBadge };
  }
}
function when(idea) {
  try {
    return new Date(idea.updatedAt).toLocaleString(props.language === 'en' ? 'en-US' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return idea.updatedAt;
  }
}

function open(idea) {
  if (store.reopenIdea(idea.id)) emit('open');
}
function regenerate(idea) {
  if (store.reopenIdea(idea.id)) emit('regenerate');
}
function startEdit(idea) {
  editingId.value = idea.id;
  editForm.value = { title: idea.title, tags: (idea.tags || []).join(', '), prompt: idea.generationPrompt };
}
function saveEdit() {
  const tagList = editForm.value.tags.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
  store.updateIdea(editingId.value, { title: editForm.value.title.trim(), tags: tagList, generationPrompt: editForm.value.prompt }, 'edit');
  editingId.value = null;
}
async function remove(idea) {
  if (!window.confirm(t.value.confirmDelete)) return;
  const outcome = await store.deleteIdea(idea.id);
  if (!outcome.ok) say(`${t.value.deleteFailed}${outcome.message}`, 'alert');
}
async function syncOne(idea) {
  const outcome = await store.syncIdea(idea.id);
  if (!outcome.ok) say(`${t.value.syncFailed}${outcome.message}`, 'alert');
}
function say(message, kind = 'status') {
  notice.value = message;
  noticeKind.value = kind;
}

function exportJson() {
  const payload = JSON.stringify(store.exportData(), null, 2);
  try {
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aloop-spark-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    say(`${t.value.storageFailed}${error?.message || ''}`, 'alert');
  }
}
async function deleteAll() {
  if (!window.confirm(t.value.confirmDeleteAll)) return;
  const outcome = await store.deleteAllData();
  if (!outcome.ok) say(`${t.value.deleteFailed}${outcome.cloud?.message || ''}`, 'alert');
  else say(outcome.cloud.attempted ? t.value.deleteAllDone : t.value.deleteAllLocalDone);
}

onMounted(() => {
  for (const idea of store.state.ideas) {
    if (idea.assetPath && !idea.visualSvg) store.ensureAssetUrl(idea.id);
  }
});
</script>

<template>
  <div class="spark-library" data-testid="spark-library">
    <header class="spark-library-head">
      <h2 class="spark-h2">{{ t.libraryTitle }} <span class="spark-count" data-testid="spark-count">{{ store.state.ideas.length }}</span></h2>
      <div class="spark-library-tools">
        <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-export" @click="exportJson">{{ t.exportJson }}</button>
        <button type="button" class="spark-btn spark-btn-danger" data-testid="spark-delete-all" @click="deleteAll">{{ t.deleteAll }}</button>
      </div>
    </header>

    <p class="spark-note" data-testid="spark-library-notice">{{ signedIn ? t.cloudNotice : t.localNotice }}</p>
    <p v-if="store.state.cloud.loading" class="spark-note" role="status">{{ t.cloudLoading }}</p>
    <p v-if="store.state.cloud.error" class="spark-alert" role="alert">{{ t.syncFailed }}{{ store.state.cloud.error.message }}</p>
    <p v-if="store.state.storageError" class="spark-alert" role="alert" data-testid="spark-storage-error">{{ t.storageFailed }}{{ store.state.storageError.message }}</p>
    <p v-if="notice" class="spark-note" :role="noticeKind === 'alert' ? 'alert' : 'status'">{{ notice }}</p>

    <div class="spark-filters">
      <input v-model="query" class="spark-input" type="search" data-testid="spark-search" :placeholder="t.librarySearch" :aria-label="t.librarySearch" />
      <select v-model="tag" class="spark-input" :aria-label="t.libraryAllTags">
        <option value="">{{ t.libraryAllTags }}</option>
        <option v-for="item in tags" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="mode" class="spark-input" :aria-label="t.libraryAllModes">
        <option value="">{{ t.libraryAllModes }}</option>
        <option v-for="(label, key) in t.modes" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="sync" class="spark-input" :aria-label="t.libraryAllSync">
        <option value="">{{ t.libraryAllSync }}</option>
        <option value="local">{{ t.libraryLocalOnly }}</option>
        <option value="synced">{{ t.librarySyncedOnly }}</option>
      </select>
    </div>

    <p v-if="!store.state.ideas.length" class="spark-empty" data-testid="spark-empty">{{ t.libraryEmpty }}</p>
    <p v-else-if="!ideas.length" class="spark-empty">{{ t.libraryNoMatch }}</p>

    <ul class="spark-grid">
      <li v-for="idea in ideas" :key="idea.id" class="spark-capsule" data-testid="spark-capsule">
        <div class="spark-capsule-visual">
          <img v-if="imageFor(idea)" :src="imageFor(idea)" :alt="idea.visualDescription || idea.title" loading="lazy" />
          <div v-else class="spark-capsule-placeholder" aria-hidden="true"></div>
        </div>
        <div class="spark-capsule-body">
          <template v-if="editingId === idea.id">
            <label class="spark-fragment"><span>{{ t.resultTitle }}</span><input v-model="editForm.title" class="spark-input" maxlength="200" data-testid="spark-edit-title" /></label>
            <label class="spark-fragment"><span>{{ t.resultTags }}</span><input v-model="editForm.tags" class="spark-input" data-testid="spark-edit-tags" /></label>
            <label class="spark-fragment"><span>{{ t.resultPrompt }}</span><textarea v-model="editForm.prompt" class="spark-input spark-textarea" rows="3"></textarea></label>
            <div class="spark-actions">
              <button type="button" class="spark-btn spark-btn-primary" data-testid="spark-edit-save" @click="saveEdit">{{ t.saveEdit }}</button>
              <button type="button" class="spark-link" @click="editingId = null">{{ t.cancelEdit }}</button>
            </div>
          </template>
          <template v-else>
            <h3 class="spark-capsule-title" data-testid="spark-capsule-title">{{ idea.title || (language === 'en' ? 'Untitled spark' : '未命名瞬间') }}</h3>
            <p class="spark-capsule-meta">
              <span class="spark-badge" :data-sync="badge(idea).key" data-testid="spark-sync-badge">{{ badge(idea).text }}</span>
              <span class="spark-badge spark-badge-mode">{{ t.modes[idea.inputMode] || idea.inputMode }}</span>
              <time :datetime="idea.updatedAt">{{ when(idea) }}</time>
            </p>
            <p class="spark-capsule-desc">{{ idea.visualDescription || idea.rawInput }}</p>
            <ul v-if="idea.tags?.length" class="spark-tags"><li v-for="item in idea.tags" :key="item">{{ item }}</li></ul>
            <p v-if="idea.syncError" class="spark-alert" role="alert">{{ idea.syncError }}</p>
            <div class="spark-capsule-actions">
              <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-open" @click="open(idea)">{{ t.open }}</button>
              <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-edit" @click="startEdit(idea)">{{ t.edit }}</button>
              <button type="button" class="spark-btn spark-btn-ghost" data-testid="spark-regen-idea" @click="regenerate(idea)">{{ t.regenerateIdea }}</button>
              <button v-if="canSync && idea.syncState !== 'synced'" type="button" class="spark-btn spark-btn-ghost" data-testid="spark-sync-idea" :disabled="idea.syncing" @click="syncOne(idea)">{{ t.syncCloud }}</button>
              <button type="button" class="spark-link spark-link-danger" data-testid="spark-delete" @click="remove(idea)">{{ t.remove }}</button>
            </div>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>
