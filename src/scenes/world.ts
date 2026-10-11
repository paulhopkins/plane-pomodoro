import type { Airport } from '../data/airports';
import { hash, smoothstep } from '../util/math';

export type Terrain = 'grass' | 'fields' | 'dry' | 'sand' | 'town' | 'city' | 'water' | 'lagoon';

export interface Weather {
  low: number;
  mid: number;
  high: number;
  lowBase: number;
  haze: number;
}

/**
 * The world for one leg: the origin airport sits at global x = 0 (our gate),
 * the destination's gate at `destOffset`. Between them is generic en-route terrain.
 */
export interface World {
  origin: Airport;
  dest: Airport;
  destOffset: number;
  longHaul: boolean;
  seed: number;
}

const ENROUTE_WEATHER: Weather = { low: 0.3, mid: 0.25, high: 0.35, lowBase: 1500, haze: 0.3 };

export function originWeight(gx: number): number {
  return 1 - smoothstep(30_000, 75_000, gx);
}

export function destWeight(w: World, gx: number): number {
  return smoothstep(w.destOffset - 95_000, w.destOffset - 45_000, gx);
}

function airportTerrain(a: Airport, lx: number, z: number, h: number): Terrain {
  const s = a.skyline;
  if (s.island && lx > s.xMin - 300 && lx < s.xMax + 300 && z > s.zMin - 200 && z < s.zMax + 200) return 'city';
  if (Math.abs(lx) < 80_000) {
    for (const [z1, z2] of a.shallows ?? []) if (z >= z1 && z <= z2) return 'lagoon';
    for (const [z1, z2] of a.water) if (z >= z1 && z <= z2) return 'water';
  }
  // Suburbs spread around the skyline; a small town close to the field gets proportionally less.
  const m = Math.min(1, s.zMin / 6000);
  if (lx > s.xMin - 3000 * m && lx < s.xMax + 3000 * m && z > s.zMin - 2500 * m && z < s.zMax + 3000 * m) return 'city';
  if (z > 2500 && h < 0.22) return 'town';
  switch (a.surround) {
    case 'grass':
      return z > 900 && h > 0.55 ? 'fields' : 'grass';
    case 'dry':
      return h > 0.7 ? 'town' : 'dry';
    case 'sand':
      return 'sand';
  }
}

export function terrainAt(w: World, gx: number, z: number, i: number, k: number): Terrain {
  const h = hash(i, k, w.seed);
  const pick = hash(i, k, w.seed + 7);
  if (pick < originWeight(gx)) return airportTerrain(w.origin, gx, z, h);
  if (pick < destWeight(w, gx)) return airportTerrain(w.dest, gx - w.destOffset, z, h);
  if (w.longHaul) return h < 0.04 ? 'fields' : 'water';
  return h < 0.12 ? 'town' : 'fields';
}

export function weatherAt(w: World, gx: number): Weather {
  const o = originWeight(gx);
  const d = destWeight(w, gx) * (1 - o);
  const e = 1 - o - d;
  const mixW = (key: keyof Weather) => w.origin.weather[key] * o + w.dest.weather[key] * d + ENROUTE_WEATHER[key] * e;
  return { low: mixW('low'), mid: mixW('mid'), high: mixW('high'), lowBase: mixW('lowBase'), haze: mixW('haze') };
}
