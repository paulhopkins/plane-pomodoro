import { css, hex, mix, type RGB } from '../util/color';
import { hash } from '../util/math';
import { fogAmount, lit, py, shadeRGB, type View } from './view';
import { terrainAt, type Terrain, type World } from './world';

const PALETTE: Record<Terrain, RGB[]> = {
  grass: ['#5f8a3e', '#6a9445', '#587f39', '#71984b'].map(hex),
  fields: ['#7b9a4a', '#a3a05a', '#66883d', '#8c8850', '#5b7d3a', '#9a9a62'].map(hex),
  dry: ['#a8996b', '#b3a476', '#9b8b60', '#8f8d5c'].map(hex),
  sand: ['#d8c08e', '#dcc597', '#cfb47f', '#d4ba89'].map(hex),
  town: ['#8b8a7f', '#7f8177', '#94918a', '#7a8070'].map(hex),
  city: ['#76787a', '#86837d', '#6c6e72', '#7f7b76'].map(hex),
  water: ['#2e5b7a', '#2d5876', '#305f7e'].map(hex),
  lagoon: ['#3fa3ad', '#47adb3', '#389aa8'].map(hex),
};

const Z0 = 3;
const RATIO = 1.17;
const LN_RATIO = Math.log(RATIO);
const LIGHT_COLORS = ['#ffd38a', '#ffbf6b', '#fff0c8', '#ffcf7a'];

export function nearTerrainColor(v: View, w: World): RGB {
  const t = terrainAt(w, v.camX, 40, 0, 0);
  return lit(v, PALETTE[t][0]);
}

/** Flat patchwork terrain from the bottom of the view out to the horizon. */
export function drawGround(v: View, w: World): void {
  const { ctx } = v;
  const span = v.bottomY - v.horizonY;
  if (span <= 0) return;

  // Base gradient (covers the thinnest distant rows).
  const near = shadeRGB(v, PALETTE[terrainAt(w, v.camX, 400, 1, 1)][0], v.camH * 2 + 200);
  const g = ctx.createLinearGradient(0, v.horizonY, 0, v.bottomY);
  g.addColorStop(0, css(v.fog));
  g.addColorStop(0.25, css(mix(v.fog, near, 0.6)));
  g.addColorStop(1, css(near));
  ctx.fillStyle = g;
  ctx.fillRect(-v.W, v.horizonY, v.W * 3, span + v.H);

  const zMin = (v.f * v.camH) / span;
  const zMax = Math.min((v.f * v.camH) / 0.6, 400_000);
  const k0 = Math.max(0, Math.floor(Math.log(zMin / Z0) / LN_RATIO));
  const k1 = Math.ceil(Math.log(zMax / Z0) / LN_RATIO);
  const lights: [number, number, number, string][] = [];

  for (let k = k1; k >= k0; k--) {
    const z1 = Z0 * Math.pow(RATIO, k);
    const z2 = z1 * RATIO;
    const yNear = py(v, 0, z1);
    const yFar = py(v, 0, z2);
    if (yNear - yFar < 0.35) continue;
    const tileW = z1 * 0.7;
    const half = z2 * v.spread;
    const i0 = Math.floor((v.camX - half) / tileW);
    const i1 = Math.ceil((v.camX + half) / tileW);
    const fogged = fogAmount(v, z1);
    for (let i = i0; i <= i1; i++) {
      const gx = (i + 0.5) * tileW;
      const terr = terrainAt(w, gx, z1, i, k);
      const pal = PALETTE[terr];
      const c = mix(lit(v, pal[Math.floor(hash(i, k, 3) * pal.length)]), v.fog, fogged);
      ctx.fillStyle = css(c);
      // Tiles are trapezoids: the near edge is wider on screen than the far edge.
      const xa = i * tileW, xb = (i + 1) * tileW;
      const nx1 = v.cx - (v.f * (xa - v.camX)) / z1, nx2 = v.cx - (v.f * (xb - v.camX)) / z1;
      const fx1 = v.cx - (v.f * (xa - v.camX)) / z2, fx2 = v.cx - (v.f * (xb - v.camX)) / z2;
      ctx.beginPath();
      ctx.moveTo(nx1 + 0.5, yNear);
      ctx.lineTo(nx2 - 0.5, yNear);
      ctx.lineTo(fx2 - 0.5, yFar - 0.4);
      ctx.lineTo(fx1 + 0.5, yFar - 0.4);
      ctx.fill();

      if (v.night > 0.25 && (terr === 'city' || terr === 'town')) {
        const n = terr === 'city' ? 7 : 2;
        for (let j = 0; j < n; j++) {
          const lx = xa + hash(i, k, 10 + j) * tileW;
          const lz = z1 + hash(i, k, 30 + j) * (z2 - z1);
          lights.push([
            v.cx - (v.f * (lx - v.camX)) / lz,
            py(v, 0, lz),
            Math.max(0.7, Math.min(3, (v.f * 12) / lz)),
            LIGHT_COLORS[j % LIGHT_COLORS.length],
          ]);
        }
      }
    }
  }

  if (lights.length) {
    ctx.globalAlpha = Math.min(1, (v.night - 0.25) * 2);
    for (const [x, y, r, c] of lights) {
      ctx.fillStyle = c;
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }
}
