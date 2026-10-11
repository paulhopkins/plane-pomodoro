import { css, hex, mix } from '../util/color';
import { lit, type View } from './view';

export interface WingState {
  flaps: number;
  spoilers: number;
  /** Vertical tip flex in units of U. */
  flex: number;
}

const TOP = hex('#c9ced4');
const UNDER = hex('#9aa1a9');
const DARK = hex('#6d747c');

/** The left wing, seen from a seat just behind the leading edge. Drawn in screen space. */
export function drawWing(v: View, s: WingState): void {
  const { ctx, cx, cy, U } = v;
  const P = (x: number, y: number): [number, number] => [cx + x * U, cy + y * U];
  const tipFlex = s.flex;
  // Leading and trailing edge, root to tip (fractions along the span).
  const le = (t: number): [number, number] => P(-0.8 + 2.35 * t, 0.6 - 0.6 * t + tipFlex * t * t);
  const te = (t: number): [number, number] => P(0.15 + 1.62 * t, 0.98 - 0.92 * t + tipFlex * t * t);

  const surface = mix(lit(v, TOP), v.skyHorizon, 0.12);
  const g = ctx.createLinearGradient(...P(0, 0.2), ...P(0.3, 0.95));
  g.addColorStop(0, css(mix(surface, hex('#ffffff'), 0.08 * v.light)));
  g.addColorStop(1, css(mix(surface, lit(v, UNDER), 0.6)));

  // Flaps hang below the trailing edge; draw them first so the wing overlaps their hinge.
  if (s.flaps > 0.01) {
    ctx.fillStyle = css(lit(v, UNDER));
    ctx.beginPath();
    const a = te(0.04), b = te(0.62);
    const drop = s.flaps * 0.07 * U;
    const back = s.flaps * 0.05 * U;
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineTo(b[0] + back * 0.8, b[1] + drop * 0.7);
    ctx.lineTo(a[0] + back, a[1] + drop);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(...le(0));
  for (let t = 0.1; t <= 1.001; t += 0.1) ctx.lineTo(...le(t));
  const tipTop: [number, number] = P(1.6, -0.2 + tipFlex);
  ctx.lineTo(tipTop[0], tipTop[1]);
  ctx.lineTo(tipTop[0] + 0.07 * U, tipTop[1] + 0.02 * U);
  for (let t = 1; t >= -0.001; t -= 0.1) ctx.lineTo(...te(t));
  ctx.lineTo(...P(-1.2, 1.2));
  ctx.closePath();
  ctx.fill();

  // Winglet face.
  ctx.fillStyle = css(lit(v, hex('#b6bcc3')));
  ctx.beginPath();
  ctx.moveTo(...le(0.97));
  ctx.lineTo(tipTop[0], tipTop[1]);
  ctx.lineTo(tipTop[0] + 0.07 * U, tipTop[1] + 0.02 * U);
  ctx.lineTo(...te(1));
  ctx.closePath();
  ctx.fill();

  // Leading-edge slat line and panel lines.
  ctx.strokeStyle = css(lit(v, DARK), 0.6);
  ctx.lineWidth = Math.max(1, U * 0.003);
  ctx.beginPath();
  for (let t = 0; t <= 0.95; t += 0.05) {
    const p1 = le(t), p2 = te(t);
    const q: [number, number] = [p1[0] + (p2[0] - p1[0]) * 0.07, p1[1] + (p2[1] - p1[1]) * 0.07];
    if (t === 0) ctx.moveTo(...q);
    else ctx.lineTo(...q);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let t = 0.05; t <= 0.95; t += 0.15) {
    const p1 = le(t), p2 = te(t);
    ctx.moveTo(p1[0] + (p2[0] - p1[0]) * 0.07, p1[1] + (p2[1] - p1[1]) * 0.07);
    ctx.lineTo(p1[0] + (p2[0] - p1[0]) * 0.72, p1[1] + (p2[1] - p1[1]) * 0.72);
  }
  ctx.stroke();

  // Spoilers pop up from the upper surface on landing.
  if (s.spoilers > 0.01) {
    ctx.fillStyle = css(lit(v, hex('#aab1b8')));
    for (let i = 0; i < 4; i++) {
      const t0 = 0.12 + i * 0.11, t1 = t0 + 0.1;
      const h0 = lerpPt(le(t0), te(t0), 0.72), h1 = lerpPt(le(t1), te(t1), 0.72);
      const lift = s.spoilers * 0.055 * U;
      ctx.beginPath();
      ctx.moveTo(...h0);
      ctx.lineTo(...h1);
      ctx.lineTo(h1[0] - lift * 0.3, h1[1] - lift);
      ctx.lineTo(h0[0] - lift * 0.3, h0[1] - lift);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Engine nacelle hanging forward of the wing.
  const [ex, ey] = P(-0.5, 0.86);
  ctx.fillStyle = css(lit(v, hex('#d7dbe0')));
  ctx.beginPath();
  ctx.ellipse(ex, ey, 0.2 * U, 0.12 * U, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(lit(v, hex('#3b4048')));
  ctx.beginPath();
  ctx.ellipse(ex - 0.17 * U, ey + 0.035 * U, 0.04 * U, 0.1 * U, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // Navigation (red, steady) and strobe (white, double flash) lights at the tip.
  const tip = le(1);
  const nav = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], U * (0.03 + 0.05 * v.night));
  nav.addColorStop(0, 'rgba(255,60,50,0.95)');
  nav.addColorStop(1, 'rgba(255,60,50,0)');
  ctx.fillStyle = nav;
  ctx.fillRect(tip[0] - U * 0.1, tip[1] - U * 0.1, U * 0.2, U * 0.2);
  const ph = v.t % 1.3;
  if (ph < 0.05 || (ph > 0.15 && ph < 0.2)) {
    const r = U * (0.06 + 0.12 * v.night);
    const st = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], r);
    st.addColorStop(0, 'rgba(255,255,255,1)');
    st.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = st;
    ctx.fillRect(tip[0] - r, tip[1] - r, r * 2, r * 2);
  }
}

function lerpPt(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
