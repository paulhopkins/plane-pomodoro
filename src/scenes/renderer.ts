import type { FlightState } from '../state/flight';
import { hex, mix } from '../util/color';
import { clamp, lerp, noise1, smoothstep } from '../util/math';
import { collectAirport, drawAirportSurfaces, type AirportScene } from './airport';
import { collectClouds, drawDecks, drawInCloud, inCloudAmount } from './clouds';
import { drawGround } from './ground';
import { drawHaze, drawSky, skyColors } from './sky';
import type { Drawable, View } from './view';
import { drawWing } from './wing';
import { drawCabinWall, MAX_ZOOM, MIN_ZOOM, windowLayout, windowPath } from './windowFrame';
import { weatherAt, type World } from './world';

export interface SceneInput {
  flight: FlightState;
  world: World;
  airports: AirportScene[];
  sunElev: number;
  shadeClosed: boolean;
  reducedMotion: boolean;
}

const MAX_DPR = 1.75;

export class SceneRenderer {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private shade = 0;
  private lastT = 0;
  private lastInput: SceneInput | null = null;
  private zoom = 1;
  /** Milliseconds the last frame took to draw. */
  frameMs = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /** Current shade position, snapped (used on first show). */
  setShade(closed: boolean): void {
    this.shade = closed ? 1 : 0;
  }

  getZoom(): number {
    return this.zoom;
  }

  /** Set the window zoom (clamped); returns the value applied. */
  setZoom(z: number): number {
    this.zoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
    if (this.lastInput) this.render(this.lastInput, this.lastT);
    return this.zoom;
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Resizing clears the canvas; redraw straight away rather than flash black.
    if (this.lastInput) this.render(this.lastInput, this.lastT);
  }

  /** Which window (if any) contains a client point. */
  hitWindow(clientX: number, clientY: number): boolean {
    const r = this.canvas.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    return windowLayout(this.W, this.H, this.zoom).windows.some((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
  }

  render(input: SceneInput, tSeconds: number): void {
    const t0 = performance.now();
    this.draw(input, tSeconds);
    this.frameMs = performance.now() - t0;
  }

  private draw(input: SceneInput, tSeconds: number): void {
    this.lastInput = input;
    const { ctx, W, H } = this;
    const dt = clamp(tSeconds - this.lastT, 0, 0.1);
    this.lastT = tSeconds;
    this.shade += ((input.shadeClosed ? 1 : 0) - this.shade) * Math.min(1, dt * 2.5);

    const { flight, world } = input;
    const { windows, main } = windowLayout(W, H, this.zoom);
    const U = main.h;
    const cx = W / 2;
    const cy = main.y + main.h / 2;
    const altK = clamp(flight.altitude / 11000);

    // Turbulence: gentle at cruise, livelier in the climb/descent and on the runway roll.
    const motion = input.reducedMotion ? 0 : 1;
    const bumpiness = flight.onGround
      ? clamp(flight.speed / 80) * 0.6 + (flight.speed > 1 ? 0.15 : 0)
      : flight.phase === 'cruise' ? 0.25 : 0.5;
    const shakeY = motion * bumpiness * U * 0.004 * (noise1(tSeconds * 6, 1) + 0.5 * noise1(tSeconds * 17, 2));
    const flex = motion * (flight.onGround ? 0.004 : 0.012) * noise1(tSeconds * 1.3, 5) + (flight.onGround ? 0 : -0.02);

    const weather = weatherAt(world, flight.x);
    const lowSolid = smoothstep(0.55, 0.85, weather.low);
    const overcast = flight.altitude + 4 < weather.lowBase ? lowSolid : 0;
    const sky = skyColors(input.sunElev, flight.altitude, overcast);
    const fog = mix(sky.horizon, hex('#c9d0d8'), 0.25 * sky.light);
    const visibility = lerp(80_000, 20_000, weather.haze) * (1 + altK * 0.8);

    const v: View = {
      ctx, W, H, cx, cy, U,
      f: U * 1.05,
      horizonY: cy + U * (0.06 - 0.24 * altK) + flight.bank * U * 0.012 + shakeY,
      camX: flight.x,
      camH: flight.altitude + 4,
      light: sky.light,
      night: sky.night,
      sunElev: input.sunElev,
      skyZenith: sky.zenith,
      skyHorizon: sky.horizon,
      fog,
      visibility,
      t: tSeconds,
      spread: (W * 0.5 + U * 0.6) / (U * 1.05),
      bottomY: H + W * 0.3 * Math.abs(Math.sin((flight.pitch * Math.PI) / 180)) + 60,
    };

    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    for (const r of windows) windowPath(ctx, r, 0);
    ctx.clip();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-flight.pitch * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    const overcastAbove = Math.max(overcast, overcastOverhead(v, world));
    drawSky(v, overcastAbove);
    drawDecks(v, world, 'above');
    drawGround(v, world);
    for (const a of input.airports) drawAirportSurfaces(v, a);

    // A solid deck below hides everything shorter than its top.
    const lowTop = weather.lowBase + 750;
    const deckBelow = v.camH > lowTop && lowSolid > 0.5;
    drawDecks(v, world, 'below');
    const items: Drawable[] = [];
    for (const a of input.airports) collectAirport(v, a, items, deckBelow ? lowTop : 0);
    collectClouds(v, world, items);
    items.sort((a, b) => b.z - a.z);
    for (const d of items) d.draw();
    drawHaze(v, 0.35 + weather.haze * 0.5);
    ctx.restore();

    const cloud = inCloudAmount(v, world);
    drawInCloud(v, cloud);
    drawWing(v, { flaps: flight.flaps, spoilers: flight.spoilers, flex });
    if (cloud > 0.01) drawInCloud(v, cloud * 0.35);
    ctx.restore();

    const cabinLight = flight.phase === 'cruise' && sky.night > 0.5 ? 0.45 : lerp(0.6, 1, sky.light);
    drawCabinWall(ctx, W, H, windows, this.shade, cabinLight);
  }
}

/** Overcast factor from decks overhead, without drawing. */
function overcastOverhead(v: View, world: World): number {
  const w = weatherAt(world, v.camX);
  let o = 0;
  if (v.camH < w.lowBase) o = Math.max(o, smoothstep(0.55, 0.85, w.low));
  if (v.camH < 4300) o = Math.max(o, smoothstep(0.55, 0.85, w.mid) * 0.8);
  return o;
}
