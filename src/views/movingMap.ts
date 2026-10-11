import { AIRPORTS, type Airport } from '../data/airports';
import { routePath } from '../data/routes';
import { CONTINENTS } from './worldShapes';

const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const PLANE = 'M0,-9 L1.4,-6 L1.4,-2 L8,2.5 L8,4 L1.4,2 L1.2,6 L3.5,8 L3.5,9 L0,8 L-3.5,9 L-3.5,8 L-1.2,6 L-1.4,2 L-8,4 L-8,2.5 L-1.4,-2 L-1.4,-6 Z';

/** Seat-back style moving map: equirectangular, zoomed to the current route. */
export class MovingMap {
  private key = '';
  private path: [number, number][] = [];
  private flown!: SVGPolylineElement;
  private plane!: SVGGElement;
  private scale = 1;

  constructor(private svg: SVGSVGElement) {}

  setRoute(from: Airport, to: Airport): void {
    const key = `${from.code}-${to.code}`;
    if (key === this.key) return;
    this.key = key;
    this.path = from.code === to.code ? [[from.lat, from.lon]] : routePath(from, to, 96);
    const svg = this.svg;
    svg.replaceChildren();

    const xs = this.path.map((p) => p[1]);
    const ys = this.path.map((p) => -p[0]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = Math.max(12, (x1 - x0) * 0.18, (y1 - y0) * 0.25);
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    // Match the container's aspect ratio.
    const aspect = 1.7;
    const w = x1 - x0, h = y1 - y0;
    if (w / h < aspect) { const d = h * aspect - w; x0 -= d / 2; x1 += d / 2; }
    else { const d = w / aspect - h; y0 -= d / 2; y1 += d / 2; }
    svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    this.scale = (x1 - x0) / 340;

    svg.append(el('rect', { x: x0 - 400, y: y0 - 200, width: x1 - x0 + 800, height: y1 - y0 + 400, class: 'map-sea' }));
    const grid = el('g', { class: 'map-grid' });
    for (let lon = -540; lon <= 540; lon += 15) grid.append(el('line', { x1: lon, y1: -90, x2: lon, y2: 90 }));
    for (let lat = -75; lat <= 75; lat += 15) grid.append(el('line', { x1: -540, y1: -lat, x2: 540, y2: -lat }));
    grid.setAttribute('stroke-width', String(this.scale * 0.5));
    svg.append(grid);
    const land = el('g', { class: 'map-land' });
    for (const offset of [-360, 0, 360]) {
      for (const c of CONTINENTS) {
        const pts: string[] = [];
        for (let i = 0; i < c.length; i += 2) pts.push(`${c[i] + offset},${-c[i + 1]}`);
        land.append(el('polygon', { points: pts.join(' ') }));
      }
    }
    land.setAttribute('stroke-width', String(this.scale * 0.6));
    svg.append(land);

    const line = (pts: [number, number][]) => pts.map(([lat, lon]) => `${lon},${-lat}`).join(' ');
    svg.append(el('polyline', { points: line(this.path), class: 'map-route', 'stroke-width': this.scale * 1.6, 'stroke-dasharray': `${this.scale * 4} ${this.scale * 3}` }));
    this.flown = el('polyline', { points: '', class: 'map-flown', 'stroke-width': this.scale * 2 });
    svg.append(this.flown);

    // Every airport in the network, routes' ends emphasised.
    const unwrap = (lon: number) => {
      const ref = this.path[0][1];
      while (lon - ref > 180) lon -= 360;
      while (lon - ref < -180) lon += 360;
      return lon;
    };
    for (const a of AIRPORTS) {
      const main = a.code === from.code || a.code === to.code;
      const x = unwrap(a.lon), y = -a.lat;
      svg.append(el('circle', { cx: x, cy: y, r: this.scale * (main ? 3 : 2), class: main ? 'map-apt main' : 'map-apt' }));
      const t = el('text', { x: x + this.scale * 5, y: y + this.scale * 3, class: main ? 'map-label main' : 'map-label', 'font-size': this.scale * (main ? 10 : 8) });
      t.textContent = main ? `${a.city} (${a.code})` : a.code;
      svg.append(t);
    }

    this.plane = el('g', { class: 'map-plane' });
    this.plane.append(el('path', { d: PLANE }));
    svg.append(this.plane);
  }

  /** f: fraction of the route flown (0..1). */
  update(f: number): void {
    if (!this.path.length) return;
    const n = this.path.length - 1;
    const i = Math.min(n, Math.floor(f * n));
    const frac = n === 0 ? 0 : f * n - i;
    const a = this.path[i], b = this.path[Math.min(n, i + 1)];
    const lat = a[0] + (b[0] - a[0]) * frac, lon = a[1] + (b[1] - a[1]) * frac;
    const flown = [...this.path.slice(0, i + 1), [lat, lon] as [number, number]];
    this.flown.setAttribute('points', flown.map(([la, lo]) => `${lo},${-la}`).join(' '));
    const c = this.path[Math.max(0, Math.min(n, i + 1))], p = this.path[Math.max(0, i)];
    const heading = n === 0 ? 90 : (Math.atan2(c[1] - p[1], c[0] - p[0]) * 180) / Math.PI;
    const s = this.scale * 1.2;
    this.plane.setAttribute('transform', `translate(${lon},${-lat}) rotate(${heading}) scale(${s})`);
  }
}
