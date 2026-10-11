import type { Airport, Ridge } from '../data/airports';
import { css, hex, mix } from '../util/color';
import { hash, noise1, rng, smoothstep, strSeed } from '../util/math';
import {
  drawLandmark, drawTower, LANDMARK_HALF_WIDTH, LANDMARK_HEIGHT, towerHeight, type Paint,
} from './landmarks';
import { fogAmount, px, py, shade, visibleX, type Drawable, type View } from './view';

export interface AirportScene {
  airport: Airport;
  /** Global x of the airport's local origin (our gate). */
  offset: number;
  /** Local x range of the runway we use. */
  runway: [number, number];
  jetBridge: boolean;
}

const TERMINAL = { x1: -520, x2: 170, z: 150, depth: 70, h: 13 };
const GATES = [-390, -260, -130];
const TAXI_MIN = -1500;

interface Building { x: number; z: number; w: number; h: number; c: string; seed: number }
const SKYLINES = new Map<string, Building[]>();
const BUILDING_COLS = ['#8a8e94', '#9b968c', '#7b8590', '#a5a9ad', '#6f7881', '#b0a999'];

function skyline(a: Airport): Building[] {
  let list = SKYLINES.get(a.code);
  if (list) return list;
  const r = rng(strSeed(a.code));
  const s = a.skyline;
  const n = Math.round(((s.xMax - s.xMin) / 110) * s.density);
  list = [];
  for (let i = 0; i < n; i++) {
    const x = s.xMin + r() * (s.xMax - s.xMin);
    // Cluster tall buildings towards the middle of the skyline.
    const mid = 1 - Math.abs((x - s.xMin) / (s.xMax - s.xMin) - 0.5) * 2;
    const h = 15 + Math.pow(r(), 2.2) * s.maxH * (0.35 + 0.65 * mid);
    list.push({
      x,
      z: s.zMin + r() * (s.zMax - s.zMin),
      w: 25 + r() * 55,
      h,
      c: BUILDING_COLS[Math.floor(r() * BUILDING_COLS.length)],
      seed: Math.floor(r() * 1e6),
    });
  }
  SKYLINES.set(a.code, list);
  return list;
}

function paint(v: View, z: number): Paint {
  const fog = fogAmount(v, z);
  return {
    ctx: v.ctx,
    c: (h, a = 1) => shade(v, hex(h), z, a),
    glow: (h, a = 1) => css(mix(hex(h), v.fog, fog * 0.7), a),
    night: v.night,
    t: v.t,
  };
}

/** Draw `fn` in metres at a world position; returns false if culled. */
function placed(v: View, gx: number, z: number, scale: number, fn: (p: Paint) => void): void {
  const k = (v.f / z) * scale;
  const { ctx } = v;
  ctx.save();
  ctx.translate(px(v, gx, z), py(v, 0, z));
  ctx.scale(k, k);
  fn(paint(v, z));
  ctx.restore();
}

function groundQuad(v: View, x1: number, x2: number, z1: number, z2: number, fill: string): void {
  const { ctx } = v;
  const zn = Math.max(z1, 0.5);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(px(v, x1, zn), py(v, 0, zn));
  ctx.lineTo(px(v, x2, zn), py(v, 0, zn));
  ctx.lineTo(px(v, x2, z2), py(v, 0, z2));
  ctx.lineTo(px(v, x1, z2), py(v, 0, z2));
  ctx.closePath();
  ctx.fill();
}

function nearAirport(v: View, s: AirportScene): boolean {
  const lx = v.camX - s.offset;
  return lx > -120_000 && lx < 120_000;
}

/** Runway, taxiway and apron surfaces. Drawn straight after the ground. */
export function drawAirportSurfaces(v: View, s: AirportScene): void {
  if (!nearAirport(v, s) || v.camH > 4000) return;
  const o = s.offset;
  const [r1, r2] = s.runway;
  const X = (x: number) => o + x;
  const asphalt = shade(v, hex('#7c8085'), 20);
  const runway = shade(v, hex('#54585d'), 20);
  const white = shade(v, hex('#e9e9e4'), 20);
  const concrete = shade(v, hex('#b6b3ab'), 60);

  if (visibleX(v, X(TAXI_MIN), X(r2 + 400), 30)) groundQuad(v, X(TAXI_MIN), X(r2 + 400), 0, 30, asphalt);
  groundQuad(v, X(r1), X(r2), 0, 24, runway);
  groundQuad(v, X(r1), X(r2), 22.4, 23.4, white);
  // Threshold piano keys and touchdown-zone bars.
  for (let i = 0; i < 4; i++) groundQuad(v, X(r1 + 10), X(r1 + 55), 3 + i * 4.5, 5 + i * 4.5, white);
  for (let x = r1 + 150; x < Math.min(r1 + 900, r2); x += 150) groundQuad(v, X(x), X(x + 22), 9, 12.5, white);

  groundQuad(v, X(TERMINAL.x1 - 80), X(TERMINAL.x2 + 120), 30, TERMINAL.z, concrete);
  const yellow = shade(v, hex('#e4b62c'), 60);
  for (const g of [...GATES, 0]) groundQuad(v, X(g - 0.4), X(g + 0.4), 30, TERMINAL.z - 2, yellow);
  groundQuad(v, X(-3000), X(6000), 150, 158, shade(v, hex('#8e8f8c'), 150));
}

function edgeLights(v: View, s: AirportScene, out: Drawable[]): void {
  const z = 25.5;
  const half = z * v.spread;
  const lx = v.camX - s.offset;
  const [r1, r2] = s.runway;
  for (let x = Math.ceil((lx - half) / 60) * 60; x < lx + half; x += 60) {
    if (x < TAXI_MIN || x > r2 + 400) continue;
    const onRunway = x >= r1 && x <= r2;
    const gx = s.offset + x;
    out.push({
      z,
      draw: () => {
        const sx = px(v, gx, z), sy = py(v, 0, z);
        const k = v.f / z;
        const { ctx } = v;
        ctx.fillStyle = shade(v, hex('#d9c33a'), z);
        ctx.fillRect(sx - 0.05 * k, sy - 0.4 * k, 0.1 * k, 0.4 * k);
        const col = onRunway ? '#fff6d8' : '#4d8dff';
        const r = 0.12 * k * (1 + v.night * 2.5);
        ctx.fillStyle = css(hex(col), 0.35 + 0.65 * v.night);
        ctx.beginPath();
        ctx.arc(sx, sy - 0.45 * k, r, 0, Math.PI * 2);
        ctx.fill();
      },
    });
  }
}

function terminal(v: View, s: AirportScene, out: Drawable[]): void {
  const T = TERMINAL;
  const x1 = s.offset + T.x1, x2 = s.offset + T.x2;
  if (!visibleX(v, x1, x2, T.z)) return;
  out.push({
    z: T.z,
    draw: () => {
      const { ctx } = v;
      const zf = T.z, zb = T.z + T.depth;
      if (v.camH > T.h) {
        ctx.fillStyle = shade(v, hex('#c9cdd1'), zf);
        ctx.beginPath();
        ctx.moveTo(px(v, x1, zf), py(v, T.h, zf));
        ctx.lineTo(px(v, x2, zf), py(v, T.h, zf));
        ctx.lineTo(px(v, x2, zb), py(v, T.h, zb));
        ctx.lineTo(px(v, x1, zb), py(v, T.h, zb));
        ctx.fill();
      }
      placed(v, s.offset + (T.x1 + T.x2) / 2, zf, 1, (p) => {
        const w = T.x2 - T.x1;
        const c = p.ctx;
        c.save();
        c.scale(-1, 1); // world x runs right-to-left on screen
        const left = -w / 2;
        c.fillStyle = p.c('#d5d8db');
        c.fillRect(left, -T.h, w, T.h);
        c.fillStyle = p.night > 0.3 ? p.glow('#f3c77a', 0.55 + 0.4 * p.night) : p.c('#5f7a8e');
        c.fillRect(left + 2, -T.h + 4, w - 4, T.h - 7);
        c.fillStyle = p.c('#3c4752');
        for (let x = left + 2; x < left + w; x += 14) c.fillRect(x, -T.h + 4, 0.8, T.h - 7);
        c.fillRect(left + 2, -T.h * 0.5, w - 4, 0.8);
        c.fillStyle = p.c('#eef0f2');
        c.fillRect(left - 2, -T.h - 2.5, w + 4, 2.5);
        c.restore();
        c.fillStyle = p.night > 0.3 ? p.glow('#ffffff', 0.95) : p.c('#1e3a64');
        c.font = 'bold 6px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText(s.airport.name.toUpperCase(), 0, -T.h + 9.5);
      });
    },
  });
}

function parkedAircraft(v: View, s: AirportScene, out: Drawable[]): void {
  GATES.forEach((g, i) => {
    const gx = s.offset + g;
    const z = 110;
    if (!visibleX(v, gx - 35, gx + 35, z)) return;
    const livery = s.airport.liveries[i % s.airport.liveries.length];
    out.push({
      z,
      draw: () =>
        placed(v, gx, z, 1, (p) => {
          const c = p.ctx;
          // Tail-on view of an airliner parked nose-in.
          c.fillStyle = p.c('#d9dde1');
          c.fillRect(-30, -4.2, 60, 0.9); // wings
          c.fillStyle = p.c('#9aa1a8');
          for (const ex of [-9.5, 9.5]) {
            c.beginPath();
            c.arc(ex, -2.6, 1.5, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = p.c('#eef0f2');
          c.beginPath();
          c.arc(0, -5, 3, 0, Math.PI * 2);
          c.fill();
          c.fillRect(-10, -7.2, 20, 0.7); // tailplane
          c.fillStyle = p.c(livery);
          poly(c, [-1.6, -6.5, 1.6, -6.5, 0.9, -17, -0.9, -17]);
          c.fillStyle = p.c('#1d1d1f');
          c.fillRect(-0.4, -1.8, 0.8, 1.8); // gear
        }),
    });
  });
}

function poly(c: CanvasRenderingContext2D, pts: number[]): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
}

function jetBridge(v: View, s: AirportScene, out: Drawable[]): void {
  if (!s.jetBridge) return;
  const xw = s.offset + 9;
  out.push({
    z: 9,
    draw: () => {
      const { ctx } = v;
      const zn = 9, zf = TERMINAL.z;
      ctx.fillStyle = shade(v, hex('#a6abb0'), 30);
      ctx.beginPath();
      ctx.moveTo(px(v, xw, zn), py(v, 3, zn));
      ctx.lineTo(px(v, xw, zn), py(v, 6.5, zn));
      ctx.lineTo(px(v, xw, zf), py(v, 6.5, zf));
      ctx.lineTo(px(v, xw, zf), py(v, 3, zf));
      ctx.fill();
      ctx.fillStyle = v.night > 0.3 ? css(hex('#f1d29a'), 0.8) : shade(v, hex('#4d6273'), 30);
      ctx.beginPath();
      ctx.moveTo(px(v, xw, zn), py(v, 4.2, zn));
      ctx.lineTo(px(v, xw, zn), py(v, 5.6, zn));
      ctx.lineTo(px(v, xw, zf), py(v, 5.6, zf));
      ctx.lineTo(px(v, xw, zf), py(v, 4.2, zf));
      ctx.fill();
      ctx.fillStyle = shade(v, hex('#5b6066'), 30);
      const zl = 40;
      ctx.fillRect(px(v, xw, zl) - 2, py(v, 3, zl), 4, py(v, 0, zl) - py(v, 3, zl));
    },
  });
}

function hangars(v: View, s: AirportScene, out: Drawable[]): void {
  for (const [hx, hz] of [[1650, 330], [1830, 340], [2050, 320]]) {
    const gx = s.offset + hx;
    if (!visibleX(v, gx - 70, gx + 70, hz)) continue;
    out.push({
      z: hz,
      draw: () =>
        placed(v, gx, hz, 1, (p) => {
          const c = p.ctx;
          c.fillStyle = p.c('#c2c6ca');
          c.beginPath();
          c.moveTo(-65, 0);
          c.lineTo(-65, -18);
          c.quadraticCurveTo(0, -36, 65, -18);
          c.lineTo(65, 0);
          c.fill();
          c.fillStyle = p.c('#7e858c');
          c.fillRect(-50, -15, 100, 15);
        }),
    });
  }
}

function vegetation(v: View, s: AirportScene, out: Drawable[]): void {
  const a = s.airport;
  const lx = v.camX - s.offset;
  const rows: { z0: number; z1: number; step: number; kind: 'tree' | 'palm' | 'shrub' }[] = [];
  if (a.surround === 'grass') rows.push({ z0: 500, z1: 1700, step: 22, kind: 'tree' });
  if (a.surround === 'dry') rows.push({ z0: 450, z1: 1500, step: 35, kind: 'shrub' });
  if (a.palms) rows.push({ z0: 170, z1: 260, step: 45, kind: 'palm' });
  for (const r of rows) {
    const half = r.z1 * v.spread;
    const i0 = Math.floor((lx - half) / r.step), i1 = Math.ceil((lx + half) / r.step);
    for (let i = i0; i <= i1; i++) {
      if (hash(i, 91, r.step) < 0.35) continue;
      const x = i * r.step + hash(i, 92) * r.step;
      if (x < -6000 || x > 9000) continue;
      const z = r.z0 + hash(i, 93, r.step) * (r.z1 - r.z0);
      if ([...a.water, ...(a.shallows ?? [])].some(([w1, w2]) => z >= w1 && z <= w2)) continue;
      const gx = s.offset + x;
      if (!visibleX(v, gx - 10, gx + 10, z)) continue;
      const size = 0.7 + hash(i, 94) * 0.6;
      out.push({ z, draw: () => placed(v, gx, z, size, (p) => plant(p, r.kind, i)) });
    }
  }
}

function plant(p: Paint, kind: 'tree' | 'palm' | 'shrub', i: number): void {
  const c = p.ctx;
  if (kind === 'palm') {
    c.strokeStyle = p.c('#6b5a43');
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(1.5, -9, 0.5, -18);
    c.stroke();
    c.strokeStyle = p.c('#3f6b35');
    c.lineWidth = 0.7;
    for (let j = 0; j < 7; j++) {
      const ang = -Math.PI / 2 + (j - 3) * 0.5;
      c.beginPath();
      c.moveTo(0.5, -18);
      c.quadraticCurveTo(0.5 + Math.cos(ang) * 3, -18 + Math.sin(ang) * 3 - 1, 0.5 + Math.cos(ang) * 5, -18 + Math.sin(ang) * 2 + 2);
      c.stroke();
    }
    return;
  }
  if (kind === 'shrub') {
    c.fillStyle = p.c('#6d7448');
    c.beginPath();
    c.ellipse(0, -1.5, 3, 1.8, 0, 0, Math.PI * 2);
    c.fill();
    return;
  }
  const dark = hash(i, 7) > 0.5;
  c.fillStyle = p.c(dark ? '#2f4f2a' : '#3d5e30');
  c.beginPath();
  c.ellipse(0, -9, 5, 7, 0, 0, Math.PI * 2);
  c.ellipse(2.5, -6, 4, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = p.c('#4a3b2c');
  c.fillRect(-0.4, -3, 0.8, 3);
}

function buildings(v: View, s: AirportScene, out: Drawable[], minH: number): void {
  for (const b of skyline(s.airport)) {
    if (b.h < minH) continue;
    const gx = s.offset + b.x;
    if (!visibleX(v, gx - b.w, gx + b.w, b.z)) continue;
    const k = v.f / b.z;
    if (b.h * k < 0.6) continue;
    out.push({
      z: b.z,
      draw: () => {
        const { ctx } = v;
        const sx = px(v, gx, b.z), sy = py(v, 0, b.z);
        const w = Math.max(0.8, b.w * k), h = b.h * k;
        ctx.fillStyle = shade(v, hex(b.c), b.z);
        ctx.fillRect(sx - w / 2, sy - h, w, h);
        if (v.night > 0.3 && w > 1.5) {
          ctx.fillStyle = css(mix(hex('#ffd58a'), v.fog, fogAmount(v, b.z) * 0.6), Math.min(1, v.night));
          const step = Math.max(1.5, 9 * k);
          // Key each window on its grid cell, not its screen position, so the pattern holds still as the camera moves.
          let row = 0;
          for (let y = sy - h + step; y < sy - 1; y += step, row++) {
            let col = 0;
            for (let x = sx - w / 2 + 0.5; x < sx + w / 2 - 0.5; x += step, col++) {
              if (hash(col, row, b.seed) < 0.3) ctx.fillRect(x, y, Math.max(0.6, step * 0.4), Math.max(0.6, step * 0.4));
            }
          }
        }
      },
    });
  }
}

function ridgeHeight(r: Ridge, lx: number): number {
  const seed = r.seed ?? 3;
  let h = r.h + r.amp * (noise1(lx / r.scale, seed) + 0.42 * noise1((lx * 3.6) / r.scale, seed + 1));
  const jag = r.jagged ?? 0;
  if (jag > 0) {
    // Folded noise gives sharp crests and notches.
    h += jag * r.amp * 0.4 * (1 - 2 * Math.abs(noise1((lx * 7) / r.scale, seed + 2)));
    h += jag * r.amp * 0.07 * (1 - 2 * Math.abs(noise1((lx * 23) / r.scale, seed + 3)));
  }
  let taper = 1;
  if (r.xMin !== undefined) taper = Math.min(taper, smoothstep(r.xMin - r.scale * 2, r.xMin, lx));
  if (r.xMax !== undefined) taper = Math.min(taper, 1 - smoothstep(r.xMax, r.xMax + r.scale * 2, lx));
  return Math.max(40, h) * taper;
}

/** Mountain ranges; when a cloud deck hides the ground, only peaks above `minHeight` show through it. */
function ridges(v: View, s: AirportScene, out: Drawable[], minHeight: number): void {
  const lx0 = v.camX - s.offset;
  for (const r of s.airport.ridges ?? []) {
    const { z } = r;
    if (lx0 < -90_000 - z || lx0 > 90_000 + z) continue;
    const peak = r.h + r.amp * 1.6;
    if (peak < minHeight || peak * (v.f / z) < 1) continue;
    out.push({
      z,
      draw: () => {
        const { ctx } = v;
        const x0 = -v.W, x1 = v.W * 2;
        const step = r.jagged ? 3 : 6;
        const hs: number[] = [];
        for (let sx = x0; sx <= x1; sx += step) hs.push(ridgeHeight(r, v.camX - ((sx - v.cx) * z) / v.f - s.offset));
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(x0, py(v, 0, z));
          hs.forEach((h, i) => ctx.lineTo(x0 + i * step, py(v, h, z)));
          ctx.lineTo(x0 + (hs.length - 1) * step, py(v, 0, z));
          ctx.closePath();
        };
        ctx.save();
        if (minHeight > 0) {
          ctx.beginPath();
          ctx.rect(x0, -v.H * 4, x1 - x0, py(v, minHeight, z) + v.H * 4);
          ctx.clip();
        }
        if (r.top) {
          const g = ctx.createLinearGradient(0, py(v, 0, z), 0, py(v, peak, z));
          g.addColorStop(0.15, shade(v, hex(r.col), z));
          g.addColorStop(0.8, shade(v, hex(r.top), z));
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = shade(v, hex(r.col), z);
        }
        path();
        ctx.fill();
        if (r.snow !== undefined) {
          // Snow from the crest down to a ragged snowline.
          ctx.fillStyle = shade(v, hex('#eef2f7'), z);
          ctx.beginPath();
          hs.forEach((h, i) => ctx.lineTo(x0 + i * step, py(v, h, z)));
          for (let i = hs.length - 1; i >= 0; i--) {
            const wx = v.camX - ((x0 + i * step - v.cx) * z) / v.f - s.offset;
            const line = r.snow! + r.amp * 0.25 * noise1((wx * 9) / r.scale, 77) + r.amp * 0.12 * noise1((wx * 40) / r.scale, 78);
            ctx.lineTo(x0 + i * step, py(v, Math.min(hs[i], line), z));
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      },
    });
  }
}

/**
 * Collect the airport's upright objects into the depth-sorted list.
 * `minHeight` hides anything shorter (e.g. when a cloud deck covers the ground).
 */
export function collectAirport(v: View, s: AirportScene, out: Drawable[], minHeight = 0): void {
  if (!nearAirport(v, s)) return;
  const a = s.airport;
  const lowDetail = v.camH > 2500;
  if (minHeight <= 0 && !lowDetail) {
    edgeLights(v, s, out);
    jetBridge(v, s, out);
    terminal(v, s, out);
    parkedAircraft(v, s, out);
    hangars(v, s, out);
    vegetation(v, s, out);
  }
  if (minHeight < towerHeight(a.tower.kind) && !lowDetail) {
    const gx = s.offset + a.tower.x;
    if (visibleX(v, gx - 20, gx + 20, a.tower.z)) {
      out.push({ z: a.tower.z, draw: () => placed(v, gx, a.tower.z, 1, (p) => drawTower(a.tower.kind, p)) });
    }
  }
  buildings(v, s, out, minHeight);
  ridges(v, s, out, minHeight);
  for (const l of a.landmarks) {
    const scale = l.s ?? 1;
    if (LANDMARK_HEIGHT[l.kind] * scale < minHeight) continue;
    const gx = s.offset + l.x;
    const hw = LANDMARK_HALF_WIDTH[l.kind] * scale;
    if (!visibleX(v, gx - hw, gx + hw, l.z)) continue;
    if (LANDMARK_HEIGHT[l.kind] * scale * (v.f / l.z) < 1) continue;
    out.push({ z: l.z, draw: () => placed(v, gx, l.z, scale, (p) => drawLandmark(l.kind, p)) });
  }
}
