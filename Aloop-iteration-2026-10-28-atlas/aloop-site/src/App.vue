<script setup>
import { onMounted, ref } from 'vue';

const frame = ref(null);
const status = ref('正在加载原有实验环境…');

onMounted(() => {
  const node = frame.value;
  if (!node) return;
  node.addEventListener('load', () => { status.value = ''; }, { once: true });
});
</script>

<template>
  <main class="app-shell">
    <iframe
      ref="frame"
      class="legacy-runtime"
      src="./legacy.html"
      title="Aloop legacy research environment"
      allow="fullscreen"
    />
    <p v-if="status" class="loading-status" role="status">{{ status }}</p>
  </main>
</template>
