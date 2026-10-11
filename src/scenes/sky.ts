import { css, hex, mix, ramp, type RGB } from '../util/color';
import { clamp, hash, smoothstep } from '../util/math';
import type { View } from './view';

const ZENITH: [number, RGB][] = [
  [-14, hex('#03060f')],
  [-6, hex('#141d44')],
  [0, hex('#33457e')],
  [6, hex('#4f73b0')],
  [16, hex('#2f6cc4')],
];
const HORIZON: [number, RGB][] = [
  [-14, hex('#0d1630')],
  [-6, hex('#3a3560')],
  [-1, hex('#c2685a')],
  [3, hex('#f0a46c')],
  [9, hex('#f3d2a6')],
  [18, hex('#b8d6ef')],
];
const HIGH_ZENITH = hex('#0f2f73');
const OVERCAST = hex('#9aa2ab');

export interface SkyColors {
  zenith: RGB;
  horizon: RGB;
  light: number;
  night: number;
}

/** Sky colours from sun elevation (deg), altitude (m) and how overcast it is overhead (0..1). */
export function skyColors(sunElev: number, altitude: number, overcast: number): SkyColors {
  let zenith = ramp(ZENITH, sunElev);
  let horizon = ramp(HORIZON, sunElev);
  const day = smoothstep(-4, 10, sunElev);
  const altK = clamp(altitude / 11000);
  zenith = mix(zenith, mix(zenith, HIGH_ZENITH, 0.65), altK * day);
  if (overcast > 0) {
    const grey = mix(OVERCAST, hex('#1a1e26'), 1 - day);
    zenith = mix(zenith, grey, overcast * 0.9);
    horizon = mix(horizon, mix(grey, horizon, 0.3), overcast * 0.8);
  }
  const light = clamp(0.08 + 0.92 * smoothstep(-8, 12, sunElev)) * (1 - 0.3 * overcast);
  return { zenith, horizon, light, night: 1 - smoothstep(-10, -1, sunElev) };
}

const STARS = Array.from({ length: 180 }, (_, i) => ({
  x: hash(i, 1),
  y: hash(i, 2),
  r: 0.4 + hash(i, 3) * 1.1,
  tw: hash(i, 4) * 6.28,
}));

export function drawSky(v: View, overcastAbove: number): void {
  const { ctx } = v;
  const top = v.cy - v.U * 1.2;
  const g = ctx.createLinearGradient(0, top, 0, v.horizonY);
  g.addColorStop(0, css(v.skyZenith));
  g.addColorStop(0.75, css(mix(v.skyZenith, v.skyHorizon, 0.55)));
  g.addColorStop(1, css(v.skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(-v.W, -v.H, v.W * 3, v.horizonY + v.H + 2);
  ctx.fillStyle = css(v.skyHorizon);
  ctx.fillRect(-v.W, v.horizonY, v.W * 3, v.H * 2);

  const starAlpha = v.night * (1 - overcastAbove);
  if (starAlpha > 0.02) {
    for (const s of STARS) {
      const sx = s.x * v.W * 1.4 - v.W * 0.2;
      const sy = top + s.y * (v.horizonY - top) * 0.9;
      const a = starAlpha * (0.55 + 0.45 * Math.sin(v.t * 1.7 + s.tw)) * (1 - s.y * 0.6);
      ctx.fillStyle = `rgba(255,255,240,${a.toFixed(3)})`;
      ctx.fillRect(sx, sy, s.r, s.r);
    }
    // Moon.
    const mx = v.cx - v.U * 0.18, my = top + v.U * 0.45;
    ctx.fillStyle = `rgba(240,238,220,${(starAlpha * 0.9).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(mx, my, v.U * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(v.skyZenith, starAlpha);
    ctx.beginPath();
    ctx.arc(mx + v.U * 0.012, my - v.U * 0.006, v.U * 0.027, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sun.
  if (v.sunElev > -4 && v.sunElev < 55) {
    const sx = v.cx + v.U * 0.28;
    const sy = v.horizonY - v.f * Math.tan((v.sunElev * Math.PI) / 180);
    const warm = 1 - smoothstep(0, 18, v.sunElev);
    const core = mix(hex('#fffbe8'), hex('#ffb35c'), warm);
    const vis = 1 - overcastAbove * 0.95;
    const r = v.U * 0.5;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    glow.addColorStop(0, css(core, 0.9 * vis));
    glow.addColorStop(0.08, css(core, 0.55 * vis));
    glow.addColorStop(0.35, css(core, 0.12 * vis));
    glow.addColorStop(1, css(core, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.fillStyle = css(mix(core, hex('#ffffff'), 0.5), vis);
    ctx.beginPath();
    ctx.arc(sx, sy, v.U * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Atmospheric haze band hugging the horizon. */
export function drawHaze(v: View, strength: number): void {
  const { ctx } = v;
  const h = v.U * (0.08 + 0.12 * strength);
  const g = ctx.createLinearGradient(0, v.horizonY - h, 0, v.horizonY + h * 0.6);
  g.addColorStop(0, css(v.fog, 0));
  g.addColorStop(0.6, css(v.fog, 0.55 * strength));
  g.addColorStop(1, css(v.fog, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-v.W, v.horizonY - h, v.W * 3, h * 1.6);
}
