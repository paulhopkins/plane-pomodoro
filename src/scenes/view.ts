import { css, hex, mix, type RGB } from '../util/color';

/**
 * Per-frame camera + lighting. The camera looks out of a left-hand window:
 * the aircraft travels towards +x (screen left), z is distance away from the
 * fuselage, y is height above ground.
 */
export interface View {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** Centre of the main window. */
  cx: number;
  cy: number;
  /** Main window height in px; the scene's unit of size. */
  U: number;
  /** Focal length in px. */
  f: number;
  horizonY: number;
  camX: number;
  camH: number;
  /** Ambient light 0..1. */
  light: number;
  /** 0 = day, 1 = full night. */
  night: number;
  sunElev: number;
  skyZenith: RGB;
  skyHorizon: RGB;
  fog: RGB;
  /** Distance (m) at which fog reaches ~63%. */
  visibility: number;
  t: number;
  /** Half-width of the visible world per metre of depth, with margin for rotation. */
  spread: number;
  bottomY: number;
}

export const NIGHT_TINT = hex('#0b1226');

export function px(v: View, x: number, z: number): number {
  return v.cx - (v.f * (x - v.camX)) / z;
}

export function py(v: View, y: number, z: number): number {
  return v.horizonY + (v.f * (v.camH - y)) / z;
}

/** Apply lighting to an albedo colour. */
export function lit(v: View, c: RGB, emissive = 0): RGB {
  const k = Math.max(v.light, emissive);
  return mix(mix(NIGHT_TINT, c, 0.18), c, k);
}

export function fogAmount(v: View, z: number): number {
  return 1 - Math.exp(-z / v.visibility);
}

/** Lit + fogged colour as a CSS string. */
export function shade(v: View, c: RGB, z: number, alpha = 1): string {
  return css(mix(lit(v, c), v.fog, fogAmount(v, z)), alpha);
}

export function shadeRGB(v: View, c: RGB, z: number): RGB {
  return mix(lit(v, c), v.fog, fogAmount(v, z));
}

/** Is a world-space x-extent at depth z on screen? */
export function visibleX(v: View, x1: number, x2: number, z: number): boolean {
  const half = z * v.spread;
  return x2 > v.camX - half && x1 < v.camX + half;
}

export interface Drawable {
  z: number;
  draw: () => void;
}
