import { css, hex, mix, type RGB } from '../util/color';
import { clamp, hash, lerp, smoothstep } from '../util/math';
import { fogAmount, py, type Drawable, type View } from './view';
import { weatherAt, type World } from './world';

interface Layer {
  id: number;
  base: number;
  thick: number;
  cirrus: boolean;
  cover: (gx: number) => number;
}

const WHITE = hex('#ffffff');
const SHADOW = hex('#8b94a3');

export function cloudLayers(w: World): Layer[] {
  return [
    { id: 1, base: 0, thick: 750, cirrus: false, cover: (gx) => weatherAt(w, gx).low },
    { id: 2, base: 4300, thick: 650, cirrus: false, cover: (gx) => weatherAt(w, gx).mid },
    { id: 3, base: 9300, thick: 250, cirrus: true, cover: (gx) => weatherAt(w, gx).high },
  ];
}

function layerBase(l: Layer, w: World, gx: number): number {
  return l.id === 1 ? weatherAt(w, gx).lowBase : l.base;
}

function cloudColors(v: View): { top: RGB; bottom: RGB } {
  const tint = mix(WHITE, v.skyHorizon, 0.3);
  const top = mix(mix(hex('#20283a'), tint, v.light), v.skyHorizon, 0.1);
  const bottom = mix(mix(hex('#141a28'), SHADOW, v.light), v.skyHorizon, 0.15);
  return { top, bottom };
}

/** Push individual clouds into the depth-sorted drawable list. */
export function collectClouds(v: View, w: World, out: Drawable[]): void {
  const { top, bottom } = cloudColors(v);
  for (const l of cloudLayers(w)) {
    for (let k = 0; k < 22; k++) {
      const zRow = 250 * Math.pow(1.32, k);
      if (zRow > 90_000) break;
      const cellW = Math.max(900, zRow * 0.8);
      const half = zRow * v.spread * 1.3;
      const i0 = Math.floor((v.camX - half) / cellW);
      const i1 = Math.ceil((v.camX + half) / cellW);
      for (let i = i0; i <= i1; i++) {
        const cx = (i + hash(i, k, l.id * 11)) * cellW;
        const cover = l.cover(cx);
        if (hash(i, k, l.id * 13) > cover) continue;
        const z = zRow * (1 + 0.32 * hash(i, k, l.id * 17));
        const width = cellW * (0.45 + 0.7 * hash(i, k, l.id * 19)) * (0.6 + cover * 0.6);
        const thick = l.thick * (0.5 + 0.5 * hash(i, k, l.id * 23));
        const lb = layerBase(l, w, cx);
        const y = lb + thick * 0.5;
        const scale = v.f / z;
        if (width * scale < 2) continue;
        const sx = v.cx - (cx - v.camX) * scale;
        const sy = py(v, y, z);
        if (sy < -v.H || sy > v.H * 2) continue;
        const fog = fogAmount(v, z) * 0.85;
        // Blend (rather than switch) between looking up at and down on this cloud, so it never jumps in size.
        const above = smoothstep(0, 0.03, (v.camH - (lb + thick)) / z);
        const under = 1 - smoothstep(lb - 300, lb, v.camH);
        const seed = i * 31 + k * 7 + l.id;
        out.push({
          z,
          draw: () =>
            l.cirrus
              ? drawCirrus(v, sx, sy, width * scale, seed, mix(top, v.fog, fog))
              : drawCumulus(v, sx, sy, width * scale, thick * scale, seed, mix(top, v.fog, fog), mix(bottom, v.fog, fog), above, (v.camH - y) / z,
                  // From under the base, a cloud's underside must stay above the horizon; the limit relaxes near the base.
                  under > 0 ? ((v.horizonY - sy) * 0.75) / under : Infinity),
        });
      }
    }
  }
}

function drawCumulus(
  v: View, x: number, y: number, w: number, h: number, seed: number,
  top: RGB, bottom: RGB, seenFromAbove: number, downAngle: number, maxRy: number,
): void {
  const { ctx } = v;
  const n = 4 + Math.floor(hash(seed, 1) * 4);
  // From above, clouds read as flattened tops; level or below, as puffy towers.
  const squash = lerp(0.75, clamp(0.32 + downAngle * 1.5, 0.32, 0.7), seenFromAbove);
  // The bottom puffs reach 1.25 * ry0 below the centre.
  const ry0 = Math.min(Math.max(h * 0.5, w * 0.12) * squash, Math.max(0, maxRy));
  ctx.fillStyle = css(bottom, 0.95);
  ctx.beginPath();
  for (let j = 0; j < n; j++) {
    const fx = (j + 0.5) / n - 0.5;
    const rx = w * (0.16 + 0.12 * hash(seed, j + 2));
    const cy = y + ry0 * 0.25;
    ctx.moveTo(x + fx * w * 0.85 + rx, cy);
    ctx.ellipse(x + fx * w * 0.85, cy, rx, ry0 * (0.6 + 0.4 * hash(seed, j + 40)), 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = css(top, 0.97);
  ctx.beginPath();
  for (let j = 0; j < n; j++) {
    const fx = (j + 0.5) / n - 0.5;
    const rx = w * (0.13 + 0.11 * hash(seed, j + 2));
    const bump = 1 - Math.abs(fx) * 1.2;
    const cy = y - ry0 * 0.25 * bump - ry0 * 0.2;
    const ry = ry0 * (0.55 + 0.5 * hash(seed, j + 60)) * (0.6 + 0.4 * bump);
    ctx.moveTo(x + fx * w * 0.8 + rx, cy);
    ctx.ellipse(x + fx * w * 0.8, cy, rx, ry, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawCirrus(v: View, x: number, y: number, w: number, seed: number, c: RGB): void {
  const { ctx } = v;
  ctx.fillStyle = css(c, 0.35);
  ctx.beginPath();
  for (let j = 0; j < 3; j++) {
    const ox = (hash(seed, j) - 0.5) * w * 0.5;
    const oy = (hash(seed, j + 9) - 0.5) * w * 0.04;
    ctx.moveTo(x + ox + w * 0.5, y + oy);
    ctx.ellipse(x + ox, y + oy, w * 0.5, Math.max(0.6, w * 0.018), -0.03, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * Solid cloud decks: a ceiling when the layer is overhead, a floor when below.
 * Returns how overcast the sky above the aircraft is (0..1).
 */
export function drawDecks(v: View, w: World, phase: 'above' | 'below'): number {
  const { ctx } = v;
  const { top, bottom } = cloudColors(v);
  let overcastAbove = 0;
  for (const l of cloudLayers(w)) {
    if (l.cirrus) continue;
    const cover = l.cover(v.camX);
    const solid = smoothstep(0.55, 0.85, cover);
    if (solid <= 0) continue;
    const base = layerBase(l, w, v.camX);
    const deckTop = base + l.thick;
    if (v.camH < base) {
      overcastAbove = Math.max(overcastAbove, solid);
      if (phase !== 'above') continue;
      // Ceiling: everything from its far edge up to the top of the view.
      const yFar = py(v, base, 60_000);
      const g = ctx.createLinearGradient(0, v.cy - v.U, 0, yFar);
      g.addColorStop(0, css(bottom, solid));
      g.addColorStop(1, css(mix(bottom, v.fog, 0.6), solid * 0.9));
      ctx.fillStyle = g;
      ctx.fillRect(-v.W, -v.H, v.W * 3, yFar + v.H);
    } else if (v.camH > deckTop && phase === 'below') {
      const yNear = py(v, deckTop, 400);
      const g = ctx.createLinearGradient(0, v.horizonY, 0, Math.min(yNear, v.bottomY));
      g.addColorStop(0, css(mix(top, v.fog, 0.6), solid));
      g.addColorStop(1, css(top, solid));
      ctx.fillStyle = g;
      ctx.fillRect(-v.W, v.horizonY - 1, v.W * 3, v.bottomY - v.horizonY + v.H);
    }
  }
  return overcastAbove;
}

/** White-out when the aircraft is flying through a cloud layer. Returns its opacity. */
export function inCloudAmount(v: View, w: World): number {
  let a = 0;
  for (const l of cloudLayers(w)) {
    if (l.cirrus) continue;
    const base = layerBase(l, w, v.camX);
    const inside = smoothstep(base - 150, base + 80, v.camH) * (1 - smoothstep(base + l.thick - 80, base + l.thick + 150, v.camH));
    a = Math.max(a, inside * smoothstep(0.2, 0.7, l.cover(v.camX)));
  }
  return a;
}

export function drawInCloud(v: View, amount: number): void {
  if (amount <= 0.01) return;
  const { ctx } = v;
  const c = mix(hex('#2a3140'), hex('#e9edf2'), v.light);
  ctx.fillStyle = css(c, Math.min(0.92, amount * 0.92));
  ctx.fillRect(0, 0, v.W, v.H);
  // Wisps streaming past.
  ctx.fillStyle = css(mix(c, hex('#ffffff'), 0.4), amount * 0.35);
  for (let j = 0; j < 8; j++) {
    const speed = 1.4 + hash(j, 5) * 1.5;
    const x = ((hash(j, 6) * 2 + v.t * speed) % 2) * v.W * 1.5 - v.W * 0.25;
    const y = v.cy + (hash(j, 7) - 0.5) * v.U * 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, v.U * (0.3 + hash(j, 8) * 0.4), v.U * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
