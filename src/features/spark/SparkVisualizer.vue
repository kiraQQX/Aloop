<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { SparkField } from './sparkField';

// Canvas 2D neural-field instrument. The loop runs only while it is allowed to
// animate (not paused, no reduced-motion preference, tab visible, on screen);
// otherwise a single static frame is drawn on demand.
const props = defineProps({
  phase: { type: String, default: 'idle' },
  drive: { type: Number, default: 0.25 },
  paused: { type: Boolean, default: false },
  reduced: { type: Boolean, default: false },
  speed: { type: Number, default: 1 },
  pulseKey: { type: Number, default: 0 },
  label: { type: String, default: '' },
});
const emit = defineEmits(['visibility', 'running']);

const host = ref(null);
const canvas = ref(null);
let field = null;
let ctx = null;
let dpr = 1;
let raf = 0;
let last = 0;
let carry = 0;
let inView = true;
let docVisible = true;
let resizeObserver = null;
let intersectionObserver = null;
let mobile = false;

function isMobile() {
  try {
    return window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
  } catch {
    return false;
  }
}

const canRun = () => !props.paused && !props.reduced && inView && docVisible;

function drawFrame() {
  if (!ctx || !field) return;
  field.draw(ctx);
}

function tick(now) {
  raf = 0;
  if (!canRun()) { emit('running', false); drawFrame(); return; }
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  carry += dt;
  const frameBudget = mobile ? 1 / 30 : 0;
  if (carry >= frameBudget) {
    field.step(carry * props.speed);
    drawFrame();
    carry = 0;
  }
  raf = requestAnimationFrame(tick);
}

function sync() {
  if (!field) return;
  if (canRun()) {
    if (!raf) { last = 0; carry = 0; emit('running', true); raf = requestAnimationFrame(tick); }
  } else {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    emit('running', false);
    drawFrame();
  }
}

function resize() {
  if (!canvas.value || !host.value || !field) return;
  const rect = host.value.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  canvas.value.width = Math.round(w * dpr);
  canvas.value.height = Math.round(h * dpr);
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  field.resize(w, h);
  drawFrame();
}

function localPoint(event) {
  const rect = canvas.value.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPointerMove(event) {
  if (!field || props.reduced) return;
  const { x, y } = localPoint(event);
  field.setPointer(x, y);
  if (!raf) drawFrame();
}
function onPointerLeave() {
  field?.clearPointer();
  if (!raf) drawFrame();
}
function onPointerDown(event) {
  if (!field || props.reduced) return;
  const { x, y } = localPoint(event);
  field.ripple(x, y);
  if (!raf) {
    // Paused: let the ripple play out with a short burst of frames.
    let frames = 0;
    const burst = () => {
      field.step(1 / 60);
      drawFrame();
      frames += 1;
      if (frames < 60 && !raf) requestAnimationFrame(burst);
    };
    requestAnimationFrame(burst);
  }
}

function onVisibility() {
  docVisible = !document.hidden;
  emit('visibility', docVisible && inView);
  sync();
}

onMounted(() => {
  mobile = isMobile();
  ctx = canvas.value?.getContext?.('2d') || null;
  if (!ctx) return; // No 2D canvas (very old browser / test DOM): the page still works.
  field = new SparkField({ count: mobile ? 260 : 520, mobile });
  field.setPhase(props.phase, { instant: props.reduced || props.paused });
  field.setDrive(props.drive);
  resize();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host.value);
  } else {
    window.addEventListener('resize', resize);
  }
  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      emit('visibility', docVisible && inView);
      sync();
    });
    intersectionObserver.observe(host.value);
  }
  document.addEventListener('visibilitychange', onVisibility);
  sync();
});

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', onVisibility);
  field = null;
  ctx = null;
});

watch(() => props.phase, (phase) => {
  field?.setPhase(phase, { instant: !canRun() });
  if (!raf) drawFrame();
});
watch(() => props.drive, (value) => field?.setDrive(value));
watch(() => [props.paused, props.reduced], () => sync());
watch(() => props.pulseKey, () => {
  field?.pulse();
  if (!raf) drawFrame();
});
</script>

<template>
  <div ref="host" class="spark-field" data-testid="spark-field">
    <canvas
      ref="canvas"
      role="img"
      :aria-label="label"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @pointerdown="onPointerDown"
    />
  </div>
</template>
