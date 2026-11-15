// Spark neural field — a Canvas 2D simulation of an abstract cortical particle
// cloud. It is a visual instrument, not a measurement: nothing here is derived
// from real brain signals. The class has no DOM dependency (it only needs a 2D
// context-like object in draw()), so its stepping logic is unit-testable.

const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-phase targets the field eases toward. `converge` pulls particles to the
// centre, `expand` pushes them outward (reconstruction), `dim` recedes the field
// behind the result card.
export const PHASE_TARGETS = Object.freeze({
  idle: { converge: 0, expand: 0, wave: 0.28, pulses: 1, dim: 0, glow: 0.5 },
  guide: { converge: 0.7, expand: 0, wave: 0.4, pulses: 1.4, dim: 0, glow: 0.7 },
  capture: { converge: 1, expand: 0, wave: 0.55, pulses: 1.8, dim: 0, glow: 0.85 },
  reconstructing: { converge: 0.35, expand: 1, wave: 0.9, pulses: 3.2, dim: 0, glow: 1 },
  result: { converge: 0.15, expand: 0, wave: 0.2, pulses: 0.8, dim: 0.55, glow: 0.4 },
});

function buildNodes(count, rand) {
  const nodes = [];
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const u = rand() * TAU;
    const v = Math.acos(2 * rand() - 1);
    const gyri = 1 + 0.09 * Math.sin(6 * u + 3 * v) + 0.06 * Math.sin(9 * v - 2 * u);
    const shell = rand() < 0.7 ? 1 : 0.55 + 0.4 * rand();
    nodes.push({
      x: side * 0.46 + Math.sin(v) * Math.cos(u) * 0.46 * gyri * shell,
      y: Math.cos(v) * 0.6 * gyri * shell,
      z: Math.sin(v) * Math.sin(u) * 0.78 * gyri * shell,
      phase: rand() * TAU,
      size: 1.1 + rand() * 1.5,
      tone: rand() < 0.62 ? 0 : (rand() < 0.7 ? 1 : 2),
    });
  }
  return nodes;
}

function buildEdges(nodes, perNode, maxDist) {
  const edges = [];
  const seen = new Set();
  const count = nodes.length;
  for (let i = 0; i < count; i += 1) {
    const near = [];
    for (let j = 0; j < count; j += 1) {
      if (i === j) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < maxDist * maxDist) near.push([d, j]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(perNode, near.length); k += 1) {
      const j = near[k][1];
      const key = i < j ? i * count + j : j * count + i;
      if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
    }
  }
  return edges;
}

export class SparkField {
  constructor({ count = 520, seed = 11, mobile = false } = {}) {
    this.mobile = mobile;
    this.rand = rng(seed);
    this.w = 1;
    this.h = 1;
    this.time = 0;
    this.rot = 0;
    this.nodes = buildNodes(count, this.rand);
    this.edges = buildEdges(this.nodes, mobile ? 1 : 2, 0.3);
    this.pulses = Array.from({ length: mobile ? 10 : 22 }, () => this._newPulse());
    this.phase = 'idle';
    this.state = { ...PHASE_TARGETS.idle, flash: 0 };
    this.target = { ...PHASE_TARGETS.idle };
    this.drive = 0.25;
    this.pointer = null;
    this.ripples = [];
    this.proj = new Float32Array(count * 3);
  }

  _newPulse() {
    return { e: Math.floor(this.rand() * Math.max(1, this.edges?.length || 1)), t: this.rand(), speed: 0.25 + this.rand() * 0.45, hot: this.rand() < 0.18 };
  }

  resize(w, h) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
  }

  setPhase(phase, { instant = false } = {}) {
    this.phase = PHASE_TARGETS[phase] ? phase : 'idle';
    this.target = { ...PHASE_TARGETS[this.phase] };
    if (instant) Object.assign(this.state, this.target);
  }

  setDrive(value) { this.drive = clamp(Number(value) || 0); }
  setPointer(x, y) { this.pointer = { x, y }; }
  clearPointer() { this.pointer = null; }

  ripple(x, y) {
    this.ripples.push({ x, y, age: 0 });
    if (this.ripples.length > 6) this.ripples.shift();
    this.state.flash = Math.min(1, this.state.flash + 0.25);
  }

  pulse() { this.state.flash = 1; }

  step(dt) {
    const d = clamp(dt, 0, 0.05);
    const k = 1 - Math.exp(-d * 2.2);
    for (const key of ['converge', 'expand', 'wave', 'pulses', 'dim', 'glow']) {
      this.state[key] += (this.target[key] - this.state[key]) * k;
    }
    this.state.flash *= Math.exp(-d * 2.5);
    this.time += d;
    this.rot += d * 0.07 * (1 + this.state.expand);
    for (const ripple of this.ripples) ripple.age += d;
    this.ripples = this.ripples.filter((ripple) => ripple.age < 1.6);
    for (const pulse of this.pulses) {
      pulse.t += d * pulse.speed * this.state.pulses;
      if (pulse.t >= 1) Object.assign(pulse, this._newPulse(), { t: 0 });
    }
  }

  project() {
    const { w, h, state, proj } = this;
    const cx = w * 0.5;
    const cy = h * 0.46;
    const R = Math.min(w * 0.46, h * 0.62);
    const cos = Math.cos(this.rot);
    const sin = Math.sin(this.rot);
    const pointer = this.pointer;
    const reach = this.mobile ? 70 : 110;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const n = this.nodes[i];
      const outward = state.expand * (0.55 + 0.35 * Math.sin(this.time * 1.3 + n.phase));
      const scale = (1 - 0.38 * state.converge) * (1 + outward * 0.6);
      const x = n.x * scale + Math.sin(this.time * 0.5 + n.phase) * 0.015;
      const y = n.y * scale + Math.cos(this.time * 0.43 + n.phase * 1.3) * 0.015;
      const z = n.z * scale;
      const rx = x * cos - z * sin;
      const rz = x * sin + z * cos;
      const persp = 1 / (1 - rz * 0.32);
      let sx = cx + rx * R * persp;
      let sy = cy + y * R * persp;
      if (pointer) {
        const dx = sx - pointer.x;
        const dy = sy - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < reach && dist > 0.001) {
          const f = (1 - dist / reach) ** 2 * 18;
          sx += (dx / dist) * f;
          sy += (dy / dist) * f;
        }
      }
      proj[i * 3] = sx;
      proj[i * 3 + 1] = sy;
      proj[i * 3 + 2] = persp;
    }
  }

  draw(ctx) {
    const { w, h, state, proj } = this;
    ctx.clearRect(0, 0, w, h);
    this.project();
    const fade = 1 - state.dim;
    const cx = w * 0.5;
    const cy = h * 0.46;

    // Core glow.
    const glowRadius = Math.min(w, h) * (0.55 - 0.12 * state.converge);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glow.addColorStop(0, `rgba(71,126,174,${(0.1 + 0.16 * state.glow) * fade})`);
    glow.addColorStop(1, 'rgba(71,126,174,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Neural connections.
    const maxLen = Math.min(w, h) * 0.2;
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = `rgba(90,183,189,${0.17 * fade * (0.6 + 0.4 * state.glow)})`;
    ctx.beginPath();
    for (const [a, b] of this.edges) {
      const ax = proj[a * 3];
      const ay = proj[a * 3 + 1];
      const bx = proj[b * 3];
      const by = proj[b * 3 + 1];
      if (Math.abs(ax - bx) > maxLen || Math.abs(ay - by) > maxLen) continue;
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();

    // Particles, batched by tone.
    const tones = ['71,126,174', '90,183,189', '49,94,145'];
    for (let tone = 0; tone < 3; tone += 1) {
      ctx.fillStyle = `rgba(${tones[tone]},${(tone === 2 ? 0.55 : 0.8) * fade})`;
      for (let i = 0; i < this.nodes.length; i += 1) {
        const n = this.nodes[i];
        if (n.tone !== tone) continue;
        const size = n.size * proj[i * 3 + 2] * (1 + 0.5 * this.drive * state.glow);
        ctx.fillRect(proj[i * 3] - size / 2, proj[i * 3 + 1] - size / 2, size, size);
      }
    }

    // Signal pulses travelling along connections (yellow is a rare accent).
    for (const pulse of this.pulses) {
      const edge = this.edges[pulse.e];
      if (!edge) continue;
      const [a, b] = edge;
      const px = proj[a * 3] + (proj[b * 3] - proj[a * 3]) * pulse.t;
      const py = proj[a * 3 + 1] + (proj[b * 3 + 1] - proj[a * 3 + 1]) * pulse.t;
      ctx.fillStyle = pulse.hot ? `rgba(242,204,77,${0.9 * fade})` : `rgba(180,230,235,${0.75 * fade})`;
      ctx.beginPath();
      ctx.arc(px, py, pulse.hot ? 2.2 : 1.6, 0, TAU);
      ctx.fill();
    }

    // Click ripples.
    for (const ripple of this.ripples) {
      const life = ripple.age / 1.6;
      ctx.strokeStyle = `rgba(90,183,189,${0.45 * (1 - life)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, 8 + life * 190, 0, TAU);
      ctx.stroke();
    }

    // Submission flash.
    if (state.flash > 0.01) {
      const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
      flash.addColorStop(0, `rgba(242,204,77,${0.32 * state.flash})`);
      flash.addColorStop(1, 'rgba(242,204,77,0)');
      ctx.fillStyle = flash;
      ctx.fillRect(0, 0, w, h);
    }

    // Decorative waveform. This is an animation, NOT a measured EEG trace.
    const base = h * 0.86;
    const amp = h * 0.045 * (state.wave + this.drive * 0.8 * state.glow);
    const layers = [
      { color: '90,183,189', alpha: 0.38, freq: 0.012, speed: 1.1, mult: 1 },
      { color: '71,126,174', alpha: 0.3, freq: 0.019, speed: -0.8, mult: 0.7 },
      { color: '223,233,243', alpha: 0.16, freq: 0.031, speed: 1.6, mult: 0.45 },
    ];
    const step = this.mobile ? 10 : 6;
    ctx.lineWidth = 1.1;
    for (const layer of layers) {
      ctx.strokeStyle = `rgba(${layer.color},${layer.alpha * fade})`;
      ctx.beginPath();
      for (let x = 0; x <= w; x += step) {
        const envelope = Math.sin((x / w) * Math.PI);
        const y = base + Math.sin(x * layer.freq + this.time * layer.speed) * amp * layer.mult * envelope
          + Math.sin(x * layer.freq * 2.3 - this.time * layer.speed * 0.6) * amp * 0.3 * layer.mult * envelope;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  getStats() {
    return { nodes: this.nodes.length, edges: this.edges.length, pulses: this.pulses.length };
  }
}
