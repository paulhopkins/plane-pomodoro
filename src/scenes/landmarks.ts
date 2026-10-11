import type { LandmarkKind, TowerKind } from '../data/airports';

/** Paint helpers handed to every landmark: `c` returns a lit + fogged CSS colour. */
export interface Paint {
  ctx: CanvasRenderingContext2D;
  c: (hex: string, alpha?: number) => string;
  /** Emissive (night-lit) colour: bright regardless of ambient light, still fogged. */
  glow: (hex: string, alpha?: number) => string;
  night: number;
  t: number;
}

// Every function draws in metres with y up = negative, origin at the base centre.

function poly(ctx: CanvasRenderingContext2D, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function mirror(half: number[]): number[] {
  // half: points on the left side from bottom to top; mirror them for the right side.
  const out = [...half];
  for (let i = half.length - 2; i >= 0; i -= 2) out.push(-half[i], half[i + 1]);
  return out;
}

function windowsLit(p: Paint, x: number, y: number, w: number, h: number, seed: number, step = 12): void {
  if (p.night < 0.3) return;
  const { ctx } = p;
  ctx.fillStyle = p.glow('#ffd58a', Math.min(1, p.night));
  let s = seed;
  for (let yy = y + 4; yy < y + h - 4; yy += step) {
    for (let xx = x + 3; xx < x + w - 3; xx += step * 0.8) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      if (s % 3 === 0) ctx.fillRect(xx, yy, step * 0.35, step * 0.4);
    }
  }
}

function shard(p: Paint): void {
  p.ctx.fillStyle = p.c('#8796a6');
  poly(p.ctx, [-36, 0, -9, -292, -6, -310, -2, -300, 2, -312, 6, -296, 36, 0]);
  p.ctx.fillStyle = p.c('#a9b7c6', 0.7);
  poly(p.ctx, [-36, 0, -9, -292, -2, -300, 0, 0]);
  if (p.night > 0.3) { p.ctx.fillStyle = p.glow('#fff1d6', p.night); p.ctx.fillRect(-3, -305, 6, 8); }
}

function gherkin(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#4e6a7c');
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.bezierCurveTo(-36, -95, -20, -166, 0, -180);
  ctx.bezierCurveTo(20, -166, 36, -95, 26, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.c('#2f4554');
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-26 + i * 13, 0);
    ctx.quadraticCurveTo(-10 + i * 8, -90, 10, -170);
    ctx.stroke();
  }
}

function themeBuilding(p: Paint): void {
  const { ctx } = p;
  ctx.strokeStyle = p.night > 0.4 ? p.glow('#b9a6ff') : p.c('#f2f2ee');
  ctx.lineWidth = 3.5;
  for (const span of [42, 27]) {
    ctx.beginPath();
    ctx.moveTo(-span, 0);
    ctx.quadraticCurveTo(0, -84, span, 0);
    ctx.stroke();
  }
  ctx.fillStyle = p.c('#e8e8e2');
  ctx.fillRect(-5, -26, 10, 26);
  ctx.beginPath();
  ctx.ellipse(0, -25, 27, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.night > 0.4 ? p.glow('#7cc4ff') : p.c('#9db7c9');
  ctx.beginPath();
  ctx.ellipse(0, -27, 14, 3, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function empireState(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#a39d8f');
  ctx.fillRect(-30, -80, 60, 80);
  ctx.fillRect(-22, -265, 44, 190);
  ctx.fillRect(-15, -322, 30, 60);
  ctx.fillRect(-9, -370, 18, 50);
  ctx.fillRect(-5, -384, 10, 16);
  ctx.fillRect(-2.5, -420, 5, 38);
  ctx.strokeStyle = p.c('#a39d8f');
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -420); ctx.lineTo(0, -443); ctx.stroke();
  windowsLit(p, -22, -260, 44, 180, 7);
  if (p.night > 0.3) { ctx.fillStyle = p.glow('#ff5a6e', p.night); ctx.fillRect(-9, -372, 18, 40); }
}

function oneWtc(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#7d92a6');
  poly(ctx, [-31, 0, 31, 0, 21, -417, -21, -417]);
  ctx.fillStyle = p.c('#a7bbcc', 0.8);
  poly(ctx, [-31, 0, 0, -417, -21, -417]);
  ctx.strokeStyle = p.c('#c9d2da');
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -417); ctx.lineTo(0, -541); ctx.stroke();
  if (p.night > 0.3) {
    windowsLit(p, -24, -400, 48, 380, 3);
    ctx.fillStyle = p.glow('#ffffff', p.night * (0.6 + 0.4 * Math.sin(p.t * 2)));
    ctx.fillRect(-3, -545, 6, 8);
  }
}

function eiffelShape(p: Paint, col: string, h: number): void {
  const { ctx } = p;
  const s = h / 330;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-62, 0);
  ctx.quadraticCurveTo(-30, -55, -16, -115);
  ctx.lineTo(-4, -276);
  ctx.lineTo(4, -276);
  ctx.lineTo(16, -115);
  ctx.quadraticCurveTo(30, -55, 62, 0);
  ctx.lineTo(42, 0);
  ctx.quadraticCurveTo(0, -84, -42, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-24, -60, 48, 5);
  ctx.fillRect(-15, -118, 30, 5);
  ctx.fillRect(-6, -279, 12, 4);
  ctx.fillRect(-1.5, -330, 3, 54);
  ctx.restore();
}

function eiffel(p: Paint): void {
  eiffelShape(p, p.night > 0.35 ? p.glow('#f0b54a') : p.c('#6a5846'), 330);
  if (p.night > 0.35 && Math.sin(p.t * 0.7) > 0.6) {
    // Hourly sparkle, shown on a loop because it is too lovely to wait for.
    const { ctx } = p;
    ctx.fillStyle = p.glow('#ffffff', 0.9);
    for (let i = 0; i < 40; i++) {
      const y = -Math.random() * 300;
      const half = 6 + (1 - -y / 300) * 40;
      ctx.fillRect((Math.random() - 0.5) * half, y, 2.5, 2.5);
    }
  }
}

function tokyoTower(p: Paint): void {
  eiffelShape(p, p.night > 0.35 ? p.glow('#ff8a3c') : p.c('#e2492c'), 333);
  const { ctx } = p;
  ctx.fillStyle = p.c('#f4f1ea');
  ctx.fillRect(-12, -150, 24, 12);
  ctx.fillRect(-5, -252, 10, 8);
}

function fuji(p: Paint): void {
  const { ctx } = p;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-17000, 0);
    ctx.quadraticCurveTo(-5200, -1900, -900, -3740);
    ctx.lineTo(-300, -3776);
    ctx.lineTo(300, -3770);
    ctx.lineTo(900, -3740);
    ctx.quadraticCurveTo(5200, -1900, 17000, 0);
    ctx.closePath();
  };
  ctx.fillStyle = p.c('#5d6f8f');
  shape();
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  ctx.fillStyle = p.c('#f2f5fa');
  ctx.beginPath();
  ctx.moveTo(-4000, -2650);
  for (let i = 0; i <= 16; i++) {
    const x = -4000 + i * 500;
    ctx.lineTo(x, i % 2 ? -2950 - (i % 3) * 120 : -2600);
  }
  ctx.lineTo(4000, -4000);
  ctx.lineTo(-4000, -4000);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function burj(p: Paint): void {
  const { ctx } = p;
  const half = [-40, 0, -36, -150, -30, -160, -28, -300, -22, -310, -20, -450, -15, -460, -13, -580, -9, -590, -7, -680, -4, -690, -1.5, -828];
  ctx.fillStyle = p.c('#a4b2bf');
  poly(ctx, mirror(half));
  ctx.fillStyle = p.c('#c9d3dc', 0.8);
  poly(ctx, [-40, 0, -36, -150, -30, -160, -28, -300, -22, -310, -20, -450, -15, -460, -13, -580, -9, -590, -7, -680, -4, -690, -1.5, -828, 0, -828, 0, 0]);
  windowsLit(p, -26, -560, 52, 540, 11, 16);
  if (p.night > 0.3) { ctx.fillStyle = p.glow('#ffffff', p.night * (0.5 + 0.5 * Math.sin(p.t * 3))); ctx.fillRect(-2, -834, 4, 8); }
}

function harbourBridge(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#69737c');
  ctx.beginPath();
  ctx.moveTo(-252, 0);
  ctx.quadraticCurveTo(0, -268, 252, 0);
  ctx.lineTo(236, 0);
  ctx.quadraticCurveTo(0, -214, -236, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-460, -52, 920, 7);
  ctx.strokeStyle = p.c('#69737c');
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -200; x <= 200; x += 25) {
    const yArch = -214 / 2 * (1 - (x / 236) ** 2) * 1;
    ctx.moveTo(x, yArch);
    ctx.lineTo(x, -48);
  }
  ctx.stroke();
  ctx.fillStyle = p.c('#c9b48a');
  ctx.fillRect(-300, -92, 40, 92);
  ctx.fillRect(260, -92, 40, 92);
  if (p.night > 0.3) {
    ctx.fillStyle = p.glow('#ffd58a', p.night);
    for (let x = -440; x <= 440; x += 30) ctx.fillRect(x, -54, 4, 3);
  }
}

function operaHouse(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#c7b28c');
  ctx.fillRect(-110, -12, 220, 12);
  const sails: [number, number, number][] = [
    [-95, 48, 42], [-62, 56, 60], [-26, 60, 67], [22, 42, 40], [50, 40, 30], [76, 30, 22],
  ];
  for (const [x, w, h] of sails) {
    ctx.fillStyle = p.night > 0.35 ? p.glow('#f7efe0', 0.95) : p.c('#f5f1e6');
    ctx.beginPath();
    ctx.moveTo(x, -12);
    ctx.quadraticCurveTo(x + w * 0.15, -12 - h * 1.1, x + w * 0.8, -12 - h);
    ctx.quadraticCurveTo(x + w * 0.72, -12 - h * 0.4, x + w, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.c('#bdb5a2');
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function goldenGate(p: Paint): void {
  const { ctx } = p;
  const red = p.c('#c0392b');
  ctx.strokeStyle = red;
  ctx.fillStyle = red;
  ctx.fillRect(-1150, -70, 2300, 8);
  for (const tx of [-640, 640]) {
    ctx.fillRect(tx - 12, -227, 7, 227);
    ctx.fillRect(tx + 5, -227, 7, 227);
    for (const y of [-220, -180, -135, -95]) ctx.fillRect(tx - 12, y, 24, 5);
  }
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-1150, -72);
  ctx.quadraticCurveTo(-900, -110, -640, -225);
  ctx.quadraticCurveTo(0, 60, 640, -225);
  ctx.quadraticCurveTo(900, -110, 1150, -72);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = -600; x <= 600; x += 40) {
    const t = (x + 640) / 1280;
    const y = (1 - t) * (1 - t) * -225 + 2 * (1 - t) * t * 60 + t * t * -225;
    ctx.moveTo(x, y);
    ctx.lineTo(x, -70);
  }
  ctx.stroke();
  if (p.night > 0.3) {
    ctx.fillStyle = p.glow('#ffb36b', p.night);
    for (let x = -1100; x <= 1100; x += 45) ctx.fillRect(x, -74, 5, 4);
    ctx.fillStyle = p.glow('#ff3030', p.night * (0.5 + 0.5 * Math.sin(p.t * 2.5)));
    ctx.fillRect(-645, -234, 10, 8);
    ctx.fillRect(635, -234, 10, 8);
  }
}

function transamerica(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#e6e1d6');
  poly(ctx, [-26, 0, -4, -212, -1, -260, 1, -260, 4, -212, 26, 0]);
  ctx.fillRect(-14, -160, 5, 50);
  ctx.fillRect(9, -160, 5, 50);
  windowsLit(p, -18, -150, 36, 140, 5, 10);
}

function icc(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#7f93a8');
  poly(ctx, [-33, 0, 33, 0, 33, -440, 24, -468, 0, -484, -24, -468, -33, -440]);
  ctx.fillStyle = p.c('#a9bccd', 0.75);
  poly(ctx, [-33, 0, -6, 0, -6, -480, -24, -468, -33, -440]);
  windowsLit(p, -28, -430, 56, 420, 17, 14);
  if (p.night > 0.3) {
    // The facade light show: a band of colour sweeping up the tower.
    const hue = (p.t * 40) % 360;
    const y = -((p.t * 60) % 440);
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${0.75 * p.night})`;
    ctx.fillRect(-33, y - 30, 66, 30);
  }
}

function bankOfChina(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#6d8092');
  poly(ctx, [-26, 0, 26, 0, 26, -250, 2, -315, 2, -212, -26, -175]);
  ctx.strokeStyle = p.night > 0.35 ? p.glow('#f2f6ff', 0.9) : p.c('#d9e1e8');
  ctx.lineWidth = 2;
  ctx.beginPath();
  // The X-braced triangles that give the tower its look.
  for (let y = 0; y > -240; y -= 52) {
    const top = Math.max(y - 52, -240);
    ctx.moveTo(-26, Math.max(y, -175)); ctx.lineTo(26, top);
    ctx.moveTo(26, y); ctx.lineTo(-26, Math.max(top, -175));
    ctx.moveTo(-26, Math.max(y, -175)); ctx.lineTo(26, Math.max(y, -250));
  }
  ctx.moveTo(2, -212); ctx.lineTo(26, -250);
  ctx.stroke();
  ctx.strokeStyle = p.c('#c9d2da');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(1, -312); ctx.lineTo(1, -367);
  ctx.moveTo(6, -300); ctx.lineTo(6, -360);
  ctx.stroke();
  if (p.night > 0.3) {
    ctx.fillStyle = p.glow('#ff3030', p.night * (0.5 + 0.5 * Math.sin(p.t * 2.2)));
    ctx.fillRect(-1.5, -371, 5, 5);
  }
}

function bigBuddha(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#41603e');
  ctx.beginPath();
  ctx.moveTo(-1700, 0);
  ctx.quadraticCurveTo(-900, -380, -260, -505);
  ctx.lineTo(260, -510);
  ctx.quadraticCurveTo(900, -380, 1700, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.c('#cfcbc0');
  ctx.fillRect(-140, -528, 280, 20);
  ctx.fillRect(-90, -545, 180, 18);
  // The 34 m statue, drawn five times life size so it reads from the airport.
  ctx.save();
  ctx.translate(0, -545);
  ctx.scale(5, 5);
  ctx.fillStyle = p.night > 0.35 ? p.glow('#e0bc6c', 0.85) : p.c('#7d6a48');
  ctx.beginPath();
  ctx.ellipse(0, -2.5, 12, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -8, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  poly(ctx, [-6.5, -11, 6.5, -11, 4.8, -24, -4.8, -24]);
  poly(ctx, [4.8, -22, 7.5, -17, 8.2, -24, 7, -25]);
  ctx.beginPath();
  ctx.arc(0, -27.6, 3.4, 0, Math.PI * 2);
  ctx.arc(0, -31.4, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function marinaBaySands(p: Paint): void {
  const { ctx } = p;
  for (const tx of [-110, 0, 110]) {
    ctx.fillStyle = p.c('#c3cad1');
    poly(ctx, [tx - 24, 0, tx + 24, 0, tx + 19, -191, tx - 19, -191]);
    ctx.fillStyle = p.c('#97a3ae');
    poly(ctx, [tx - 1.5, 0, tx + 1.5, 0, tx + 1, -191, tx - 1, -191]);
    windowsLit(p, tx - 19, -185, 38, 180, tx + 50, 10);
  }
  // The SkyPark, cantilevered off the north tower.
  ctx.fillStyle = p.c('#e6e8ea');
  ctx.beginPath();
  ctx.moveTo(-150, -190);
  ctx.lineTo(205, -190);
  ctx.quadraticCurveTo(232, -193, 240, -204);
  ctx.lineTo(-150, -206);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.c('#3f6b35');
  for (let x = -140; x < 200; x += 18) ctx.fillRect(x, -211, 9, 5);
  if (p.night > 0.3) {
    ctx.fillStyle = p.glow('#bfe8ff', p.night);
    ctx.fillRect(-150, -199, 380, 2.5);
    if (Math.sin(p.t * 0.5) > 0.3) {
      // Spectra laser show.
      ctx.strokeStyle = p.glow('#5dff8a', 0.5 * p.night);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + Math.sin(p.t * 0.8 + i * 1.3) * 0.9;
        ctx.moveTo(40, -206);
        ctx.lineTo(40 + Math.cos(a) * 900, -206 + Math.sin(a) * 900);
      }
      ctx.stroke();
    }
  }
}

function supertrees(p: Paint): void {
  const { ctx } = p;
  const trees: [number, number][] = [[-60, 26], [-30, 42], [0, 50], [28, 33], [55, 25], [80, 38]];
  trees.forEach(([x, h], i) => {
    const w = h * 0.34;
    ctx.fillStyle = p.c('#5a4a5e');
    poly(ctx, [x - 2.4, 0, x + 2.4, 0, x + 1.2, -h * 0.82, x - 1.2, -h * 0.82]);
    ctx.fillStyle = p.night > 0.35
      ? `hsla(${(p.t * 25 + i * 60) % 360}, 85%, 62%, ${0.9 * p.night})`
      : p.c('#6b5370');
    poly(ctx, [x - 1.2, -h * 0.82, x + 1.2, -h * 0.82, x + w, -h, x - w, -h]);
  });
  ctx.strokeStyle = p.c('#4a4048');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-30, -38);
  ctx.lineTo(0, -44);
  ctx.stroke();
}

function sugarloaf(p: Paint): void {
  const { ctx } = p;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-1000, 0);
    ctx.quadraticCurveTo(-820, -200, -580, -222);
    ctx.quadraticCurveTo(-400, -218, -320, -110);
    ctx.bezierCurveTo(-340, -280, -210, -396, -40, -396);
    ctx.bezierCurveTo(120, -396, 230, -300, 250, -150);
    ctx.quadraticCurveTo(290, -40, 430, 0);
    ctx.closePath();
  };
  ctx.fillStyle = p.c('#6e7268');
  shape();
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  // Forest on Urca hill and around the foot of the bare granite dome.
  ctx.fillStyle = p.c('#3f5b38');
  ctx.beginPath();
  ctx.moveTo(-1000, 0);
  ctx.lineTo(-1000, -260);
  ctx.lineTo(-330, -260);
  ctx.quadraticCurveTo(-240, -120, -160, -90);
  ctx.quadraticCurveTo(0, -40, 120, -70);
  ctx.quadraticCurveTo(220, -60, 430, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.c('#9a9a90', 0.5);
  poly(ctx, [-120, -390, -60, -396, -180, -120, -230, -140]);
  ctx.restore();
  // Cable car from Urca to the summit.
  const [ax, ay, bx, by] = [-560, -224, -60, -398];
  ctx.strokeStyle = p.c('#2a2a2a');
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 30, bx, by);
  ctx.stroke();
  const u = (Math.sin(p.t * 0.15) + 1) / 2;
  const cxp = (1 - u) ** 2 * ax + 2 * (1 - u) * u * ((ax + bx) / 2) + u * u * bx;
  const cyp = (1 - u) ** 2 * ay + 2 * (1 - u) * u * ((ay + by) / 2 + 30) + u * u * by;
  ctx.fillStyle = p.night > 0.3 ? p.glow('#ffe1a0') : p.c('#d9d4c8');
  ctx.fillRect(cxp - 6, cyp, 12, 9);
  if (p.night > 0.3) {
    ctx.fillStyle = p.glow('#ffd58a', p.night);
    for (const [x, y] of [[-60, -398], [-20, -397], [-580, -224], [-540, -222]]) ctx.fillRect(x - 3, y - 3, 6, 6);
  }
}

function corcovado(p: Paint): void {
  const { ctx } = p;
  ctx.fillStyle = p.c('#3c5a37');
  ctx.beginPath();
  ctx.moveTo(-1800, 0);
  ctx.quadraticCurveTo(-700, -260, -320, -560);
  ctx.lineTo(-90, -700);
  ctx.lineTo(70, -710);
  ctx.lineTo(220, -620);
  ctx.quadraticCurveTo(700, -250, 1700, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.c('#6e7268');
  poly(ctx, [-90, -700, 70, -710, 220, -620, 120, -560, -30, -600]);
  // Christ the Redeemer (38 m with pedestal), drawn five times life size.
  ctx.save();
  ctx.translate(0, -708);
  ctx.scale(5, 5);
  ctx.fillStyle = p.night > 0.3 ? p.glow('#f2efff', 0.95) : p.c('#e9e6dd');
  ctx.fillRect(-3, -8, 6, 8);
  poly(ctx, [-2.4, -8, 2.4, -8, 1.7, -29, -1.7, -29]);
  ctx.fillRect(-14, -27.5, 28, 2.2);
  ctx.beginPath();
  ctx.arc(0, -30.8, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function tableMountain(p: Paint): void {
  const { ctx } = p;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-6800, 0);
    ctx.quadraticCurveTo(-4900, -480, -3900, -880);
    ctx.lineTo(-3500, -1000);
    ctx.lineTo(-3150, -900);
    ctx.lineTo(-2550, -1000);
    ctx.lineTo(-2350, -1078);
    ctx.lineTo(1000, -1085);
    ctx.lineTo(1250, -960);
    ctx.lineTo(1450, -760);
    ctx.quadraticCurveTo(1800, -420, 2300, -400);
    ctx.quadraticCurveTo(2650, -520, 2950, -669);
    ctx.quadraticCurveTo(3250, -600, 3550, -380);
    ctx.quadraticCurveTo(4600, -140, 5800, 0);
    ctx.closePath();
  };
  ctx.fillStyle = p.c('#66707a');
  shape();
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, -700);
  g.addColorStop(0, p.c('#55663f'));
  g.addColorStop(0.55, p.c('#5f6c4c'));
  g.addColorStop(1, p.c('#66707a', 0));
  ctx.fillStyle = g;
  ctx.fillRect(-6800, -700, 12600, 700);
  // Vertical buttresses on the sandstone face.
  ctx.strokeStyle = p.c('#4f5862');
  ctx.lineWidth = 18;
  ctx.beginPath();
  for (let x = -2200; x < 1000; x += 260 + (x % 3) * 40) {
    ctx.moveTo(x, -1075);
    ctx.lineTo(x + 30, -720);
  }
  ctx.stroke();
  ctx.restore();
  // The tablecloth: cloud lying on the plateau and spilling over its edge.
  const drift = Math.sin(p.t * 0.12) * 120;
  ctx.fillStyle = p.c('#f3f5f8', 0.92);
  ctx.beginPath();
  ctx.moveTo(-2450 + drift, -1060);
  for (let x = -2450; x <= 1150; x += 120) {
    ctx.lineTo(x + drift, -1120 - 35 * (1 + Math.sin(x * 0.004 + p.t * 0.15)));
  }
  for (let x = 1150; x >= -2450; x -= 120) {
    const spill = 60 + 110 * (0.5 + 0.5 * Math.sin(x * 0.006 + p.t * 0.2)) * (0.5 + 0.5 * Math.sin(x * 0.0017));
    ctx.lineTo(x + drift, -1080 + spill);
  }
  ctx.closePath();
  ctx.fill();
  if (p.night > 0.3) {
    ctx.fillStyle = p.glow('#ffd58a', p.night);
    ctx.fillRect(-2320, -1095, 18, 18);
  }
}

function rockOfGibraltar(p: Paint): void {
  const { ctx } = p;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-1000, 0);
    ctx.quadraticCurveTo(-760, -110, -600, -250);
    ctx.lineTo(-500, -370);
    ctx.lineTo(-330, -398);
    ctx.lineTo(-150, -392);
    ctx.lineTo(40, -412);
    ctx.lineTo(190, -404);
    ctx.lineTo(320, -426);
    ctx.lineTo(410, -392);
    ctx.lineTo(470, -300);
    ctx.lineTo(520, -160);
    ctx.lineTo(545, -50);
    ctx.lineTo(600, 0);
    ctx.closePath();
  };
  ctx.fillStyle = p.c('#b3ad9c');
  shape();
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  // Scrub on the gentler western slope; bare limestone cliffs on the north face.
  ctx.fillStyle = p.c('#6e7c52');
  ctx.beginPath();
  ctx.moveTo(-1000, 0);
  ctx.lineTo(-1000, -400);
  ctx.lineTo(-420, -400);
  ctx.quadraticCurveTo(-380, -200, -150, -60);
  ctx.lineTo(-100, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.c('#8f8a7c', 0.45);
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const x = -90 + i * 44 + ((i * 37) % 23);
    ctx.lineWidth = 3 + (i % 4) * 2;
    ctx.moveTo(x, -430);
    ctx.lineTo(x + 10 + (i % 3) * 8, -120 - ((i * 71) % 150));
  }
  ctx.stroke();
  ctx.restore();
  if (p.night > 0.3) {
    ctx.fillStyle = p.glow('#ffd58a', p.night);
    for (let i = 0; i < 26; i++) {
      const x = -950 + (i * 97) % 820, y = -((i * 53) % 200) - 10;
      if (y > -(x + 1000) * 0.6) ctx.fillRect(x, y, 6, 5);
    }
    ctx.fillStyle = p.glow('#ff3030', p.night * (0.5 + 0.5 * Math.sin(p.t * 2)));
    ctx.fillRect(316, -436, 8, 8);
  }
}

function bergisel(p: Paint): void {
  const { ctx } = p;
  // Hillside, landing slope and the ramp sweeping down from the tower.
  ctx.fillStyle = p.c('#3f5a3a');
  ctx.beginPath();
  ctx.moveTo(-160, 0);
  ctx.quadraticCurveTo(-70, -6, -20, -26);
  ctx.lineTo(30, -30);
  ctx.quadraticCurveTo(80, -20, 140, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.c('#e8ece9');
  ctx.beginPath();
  ctx.moveTo(-150, 0);
  ctx.quadraticCurveTo(-75, -4, -28, -22);
  ctx.lineTo(-24, -20);
  ctx.quadraticCurveTo(-72, -1, -130, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.c('#8b9094');
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-2, -76);
  ctx.quadraticCurveTo(-22, -40, -38, -26);
  ctx.stroke();
  ctx.fillStyle = p.c('#a0a6aa');
  ctx.fillRect(-4, -78, 8, 50);
  // Zaha Hadid's cobra head.
  ctx.fillStyle = p.night > 0.35 ? p.glow('#9fe6d4', 0.9) : p.c('#7d9a92');
  ctx.beginPath();
  ctx.moveTo(-6, -72);
  ctx.bezierCurveTo(-12, -92, 16, -98, 24, -86);
  ctx.quadraticCurveTo(14, -80, 4, -74);
  ctx.closePath();
  ctx.fill();
}

function tigersNest(p: Paint): void {
  const { ctx } = p;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-900, 0);
    ctx.lineTo(-640, -260);
    ctx.lineTo(-560, -470);
    ctx.lineTo(-520, -700);
    ctx.lineTo(-330, -820);
    ctx.lineTo(150, -850);
    ctx.lineTo(380, -720);
    ctx.lineTo(500, -420);
    ctx.lineTo(820, 0);
    ctx.closePath();
  };
  ctx.fillStyle = p.c('#57524b');
  shape();
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  ctx.fillStyle = p.c('#2f4a30');
  ctx.beginPath();
  ctx.moveTo(-900, 0);
  for (let x = -900; x <= 820; x += 60) ctx.lineTo(x, -230 - 60 * Math.sin(x * 0.02) - (x > 0 ? 120 : 0));
  ctx.lineTo(820, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.c('#2f4a30');
  for (let x = -280; x < 160; x += 70) ctx.fillRect(x, -860, 60, 30 + (x % 3) * 8);
  ctx.restore();
  // The monastery clinging to the cliff, drawn larger than life.
  const blocks: [number, number, number, number][] = [
    [-600, -560, 70, 46], [-548, -600, 60, 52], [-500, -540, 80, 40], [-610, -500, 55, 34], [-560, -640, 44, 40],
  ];
  for (const [x, y, w, h] of blocks) {
    ctx.fillStyle = p.c('#efe8dc');
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = p.c('#7a2a20');
    ctx.fillRect(x, y + 6, w, 7);
    ctx.fillStyle = p.c('#b9862e');
    poly(ctx, [x - 6, y, x + w + 6, y, x + w - 4, y - 12, x + 4, y - 12]);
    ctx.fillStyle = p.night > 0.35 ? p.glow('#ffd58a', p.night) : p.c('#3a2a20');
    for (let wx = x + 8; wx < x + w - 8; wx += 16) ctx.fillRect(wx, y + h * 0.55, 6, 8);
  }
}

const LANDMARKS: Record<LandmarkKind, (p: Paint) => void> = {
  shard, gherkin, themeBuilding, empireState, oneWtc, eiffel, fuji, tokyoTower, burj,
  harbourBridge, operaHouse, goldenGate, transamerica, icc, bankOfChina, bigBuddha, marinaBaySands, supertrees,
  sugarloaf, corcovado, tableMountain, rockOfGibraltar, bergisel, tigersNest,
};

/** Rough height in metres, used for culling. */
export const LANDMARK_HEIGHT: Record<LandmarkKind, number> = {
  shard: 310, gherkin: 180, themeBuilding: 45, empireState: 443, oneWtc: 541, eiffel: 330, fuji: 3776,
  tokyoTower: 333, burj: 828, harbourBridge: 134, operaHouse: 80, goldenGate: 227, transamerica: 260,
  icc: 484, bankOfChina: 371, bigBuddha: 710, marinaBaySands: 211, supertrees: 50, sugarloaf: 398, corcovado: 865,
  tableMountain: 1085, rockOfGibraltar: 436, bergisel: 98, tigersNest: 872,
};

export const LANDMARK_HALF_WIDTH: Record<LandmarkKind, number> = {
  shard: 40, gherkin: 35, themeBuilding: 45, empireState: 30, oneWtc: 31, eiffel: 62, fuji: 17000,
  tokyoTower: 62, burj: 40, harbourBridge: 460, operaHouse: 110, goldenGate: 1150, transamerica: 26,
  icc: 33, bankOfChina: 26, bigBuddha: 1700, marinaBaySands: 240, supertrees: 95, sugarloaf: 1000, corcovado: 1800,
  tableMountain: 6800, rockOfGibraltar: 1000, bergisel: 160, tigersNest: 900,
};

export function drawLandmark(kind: LandmarkKind, p: Paint): void {
  LANDMARKS[kind](p);
}

interface TowerSpec { h: number; base: number; top: number; cabW: number; cabH: number; flare: number; mast: number; col: string }

const TOWERS: Record<TowerKind, TowerSpec> = {
  lhr: { h: 87, base: 9, top: 7, cabW: 17, cabH: 10, flare: 0, mast: 12, col: '#e9ecef' },
  lax: { h: 84, base: 12, top: 6, cabW: 22, cabH: 9, flare: 10, mast: 6, col: '#f1ede3' },
  jfk: { h: 98, base: 13, top: 11, cabW: 20, cabH: 10, flare: 3, mast: 10, col: '#d9dcdf' },
  cdg: { h: 80, base: 22, top: 7, cabW: 24, cabH: 9, flare: 6, mast: 8, col: '#e4e0d8' },
  hnd: { h: 115, base: 12, top: 10, cabW: 24, cabH: 11, flare: 4, mast: 10, col: '#eceef0' },
  dxb: { h: 92, base: 10, top: 6, cabW: 18, cabH: 9, flare: 6, mast: 22, col: '#efe9dc' },
  syd: { h: 75, base: 14, top: 12, cabW: 24, cabH: 9, flare: 2, mast: 8, col: '#e2e2de' },
  sfo: { h: 67, base: 14, top: 9, cabW: 26, cabH: 10, flare: 9, mast: 6, col: '#ece8de' },
  hkg: { h: 88, base: 10, top: 8, cabW: 22, cabH: 10, flare: 8, mast: 10, col: '#e6e9ec' },
  sin: { h: 78, base: 16, top: 9, cabW: 26, cabH: 11, flare: 12, mast: 8, col: '#eef0ee' },
  sdu: { h: 32, base: 10, top: 8, cabW: 14, cabH: 6, flare: 0, mast: 6, col: '#efece2' },
  cpt: { h: 55, base: 12, top: 8, cabW: 18, cabH: 8, flare: 4, mast: 8, col: '#e8e4da' },
  gib: { h: 24, base: 9, top: 8, cabW: 12, cabH: 6, flare: 0, mast: 5, col: '#f0ece2' },
  inn: { h: 36, base: 10, top: 8, cabW: 14, cabH: 7, flare: 2, mast: 6, col: '#ecebe6' },
  zqn: { h: 26, base: 9, top: 8, cabW: 12, cabH: 6, flare: 0, mast: 5, col: '#e9e6dc' },
  mle: { h: 46, base: 11, top: 8, cabW: 16, cabH: 7, flare: 4, mast: 6, col: '#f2efe6' },
  pbh: { h: 24, base: 10, top: 9, cabW: 13, cabH: 6, flare: 0, mast: 5, col: '#f1ebdc' },
};

export function towerHeight(kind: TowerKind): number {
  return TOWERS[kind].h + TOWERS[kind].mast;
}

export function drawTower(kind: TowerKind, p: Paint): void {
  const { ctx } = p;
  const s = TOWERS[kind];
  const shaftTop = s.h - s.cabH - s.flare - 2;
  ctx.fillStyle = p.c(s.col);
  poly(ctx, [-s.base / 2, 0, s.base / 2, 0, s.top / 2, -shaftTop, -s.top / 2, -shaftTop]);
  if (s.flare > 0) poly(ctx, [-s.top / 2, -shaftTop, s.top / 2, -shaftTop, s.cabW / 2, -shaftTop - s.flare, -s.cabW / 2, -shaftTop - s.flare]);
  ctx.fillRect(-s.cabW / 2 - 1, -shaftTop - s.flare - 2, s.cabW + 2, 2);
  ctx.fillStyle = p.night > 0.3 ? p.glow('#6fe3d2', 0.85) : p.c('#2c3b48');
  ctx.fillRect(-s.cabW / 2, -s.h + 2, s.cabW, s.cabH);
  ctx.fillStyle = p.c(s.col);
  ctx.fillRect(-s.cabW / 2 - 1.5, -s.h, s.cabW + 3, 2.5);
  ctx.strokeStyle = p.c('#9aa0a6');
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -s.h);
  ctx.lineTo(0, -s.h - s.mast);
  ctx.stroke();
  if (p.night > 0.2 || Math.sin(p.t * 3) > 0.9) {
    ctx.fillStyle = p.glow('#ff2a2a', 0.5 + 0.5 * Math.sin(p.t * 3));
    ctx.fillRect(-1.2, -s.h - s.mast - 1.2, 2.4, 2.4);
  }
}
