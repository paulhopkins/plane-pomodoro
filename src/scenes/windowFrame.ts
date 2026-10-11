import { css, hex, mix } from '../util/color';

export interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 2.5;

/**
 * A row of cabin windows: the main one centred, neighbours spaced along the wall.
 * `zoom` scales everything about the main window's centre (leaning in towards it).
 */
export function windowLayout(W: number, H: number, zoom = 1): { windows: WindowRect[]; main: WindowRect } {
  const w = Math.min(W * 0.56, H * 0.5) * zoom;
  const h = w * 1.42;
  const y = H * 0.47 - h / 2;
  const spacing = w * 1.9;
  const windows: WindowRect[] = [];
  let main: WindowRect | null = null;
  for (let i = -3; i <= 3; i++) {
    const x = W / 2 - w / 2 + i * spacing;
    if (x + w < 0 || x > W) continue;
    const r = { x, y, w, h, r: w * 0.44 };
    windows.push(r);
    if (i === 0) main = r;
  }
  return { windows, main: main! };
}

export function windowPath(ctx: CanvasRenderingContext2D, r: WindowRect, inset = 0): void {
  ctx.roundRect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, Math.max(0, r.r - inset));
}

const WALL = hex('#e3ddd0');
const WALL_SHADE = hex('#c8c1b2');
const SHADE = hex('#efe9dd');

/** Cabin wall with window cut-outs, bezels and pull-down shades (0 = open, 1 = closed). */
export function drawCabinWall(ctx: CanvasRenderingContext2D, W: number, H: number, windows: WindowRect[], shade: number, cabinLight: number): void {
  const dim = (c: [number, number, number]) => mix(hex('#252830'), c, cabinLight);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  for (const r of windows) windowPath(ctx, r, -r.w * 0.09);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(dim(WALL_SHADE)));
  g.addColorStop(0.35, css(dim(WALL)));
  g.addColorStop(1, css(dim(WALL_SHADE)));
  ctx.fillStyle = g;
  ctx.fill('evenodd');

  // Panel seams between windows.
  ctx.strokeStyle = css(dim(hex('#b9b2a3')), 0.6);
  ctx.lineWidth = 1;
  for (let i = 0; i < windows.length - 1; i++) {
    const x = (windows[i].x + windows[i].w + windows[i + 1].x) / 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();

  for (const r of windows) {
    const bez = r.w * 0.09;
    // Moulded bezel: a ring between the outer cut-out and the inner pane.
    ctx.save();
    ctx.beginPath();
    windowPath(ctx, r, -bez);
    windowPath(ctx, r, 0);
    const bg = ctx.createLinearGradient(r.x, r.y - bez, r.x + r.w * 0.3, r.y + r.h + bez);
    bg.addColorStop(0, css(dim(hex('#f4f0e7'))));
    bg.addColorStop(1, css(dim(hex('#bdb5a5'))));
    ctx.fillStyle = bg;
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    windowPath(ctx, r, 0);
    ctx.clip();
    // Inner reveal shadow.
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = r.w * 0.05;
    ctx.beginPath();
    windowPath(ctx, r, -r.w * 0.012);
    ctx.stroke();
    // Faint reflection on the inner pane.
    const rg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    rg.addColorStop(0, 'rgba(255,255,255,0.07)');
    rg.addColorStop(0.45, 'rgba(255,255,255,0)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.04)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    if (shade > 0.001) {
      const sh = r.h * shade;
      const sg = ctx.createLinearGradient(0, r.y, 0, r.y + sh);
      sg.addColorStop(0, css(dim(mix(SHADE, WALL_SHADE, 0.4))));
      sg.addColorStop(1, css(dim(SHADE)));
      ctx.fillStyle = sg;
      ctx.fillRect(r.x, r.y, r.w, sh);
      ctx.strokeStyle = css(dim(hex('#d6cfc0')), 0.8);
      ctx.lineWidth = 1;
      for (let y = r.y + 10; y < r.y + sh - 6; y += 14) {
        ctx.beginPath();
        ctx.moveTo(r.x, y);
        ctx.lineTo(r.x + r.w, y);
        ctx.stroke();
      }
      ctx.fillStyle = css(dim(hex('#cbc3b2')));
      ctx.fillRect(r.x, r.y + sh - r.h * 0.035, r.w, r.h * 0.035);
      ctx.fillStyle = css(dim(hex('#a59d8c')));
      ctx.beginPath();
      ctx.roundRect(r.x + r.w * 0.38, r.y + sh - r.h * 0.03, r.w * 0.24, r.h * 0.022, 4);
      ctx.fill();
    }
    ctx.restore();
  }
}
