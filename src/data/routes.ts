import { AIRPORTS, type Airport } from './airports';

const RAD = Math.PI / 180;
const EARTH_KM = 6371;

export function distanceKm(a: Airport, b: Airport): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Point a fraction f of the way along the great circle from a to b, as [lat, lon]. */
export function greatCirclePoint(a: Airport, b: Airport, f: number): [number, number] {
  const φ1 = a.lat * RAD, λ1 = a.lon * RAD, φ2 = b.lat * RAD, λ2 = b.lon * RAD;
  const d = distanceKm(a, b) / EARTH_KM;
  if (d < 1e-9) return [a.lat, a.lon];
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return [Math.atan2(z, Math.hypot(x, y)) / RAD, Math.atan2(y, x) / RAD];
}

/** Great-circle polyline with longitudes unwrapped so it never jumps across the antimeridian. */
export function routePath(a: Airport, b: Airport, n = 64): [number, number][] {
  const pts: [number, number][] = [];
  let prevLon = a.lon;
  for (let i = 0; i <= n; i++) {
    let [lat, lon] = greatCirclePoint(a, b, i / n);
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    pts.push([lat, lon]);
    prevLon = lon;
  }
  return pts;
}

export function pickDestination(from: string, random: () => number = Math.random, preferred?: string): string {
  if (preferred && preferred !== from && AIRPORTS.some((a) => a.code === preferred)) return preferred;
  const options = AIRPORTS.filter((a) => a.code !== from);
  return options[Math.floor(random() * options.length)].code;
}

export function flightNumber(random: () => number = Math.random): string {
  return `PP ${100 + Math.floor(random() * 900)}`;
}
