'use strict';
// roundRect 相容
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
// ===== 高精細模型:單位、步兵、建築、地物、礦物 =====

// ---------- 共用零件 ----------
// 砲管:從 lx0 到 lx1(局部座標),r 為半徑(格)
function barrel(ctx, Q, lx0, lx1, ly, z, r, col) {
  const a = Q(lx0, ly, z), b = Q(lx1, ly, z);
  const w = r * 2 * HW * 1.25 + 0.3;
  line(ctx, a, b, shade(col, 0.45), w);
  line(ctx, [a[0], a[1] - w * 0.22], [b[0], b[1] - w * 0.22], shade(col, 1.25), w * 0.3);
  ell(ctx, b[0], b[1], w * 0.42, w * 0.42, '#111');
}
function lamp(ctx, x, y, col, r = 0.6, on = true) {
  if (on) glow(ctx, x, y, r * 4, col, 0.7);
  circ(ctx, x, y, r, on ? '#ffffff' : shade(col, 0.4));
  if (on) circ(ctx, x, y, r * 0.6, col);
}
function sideVisible(Q, sd) { return (-sd * Q.s + sd * Q.c) > 0; }
function frontVisible(Q) { return (Q.c + Q.s) > 0; }

// 迷彩斑塊(依單位 id 固定)
function camo(ctx, Q, id, L, W, z, col) {
  for (let k = 0; k < 4; k++) {
    const h1 = hash(id * 17 + k), h2 = hash(id * 31 + k * 7), h3 = hash(id * 13 + k * 3);
    const cx = (h1 - 0.5) * L * 0.6, cy = (h2 - 0.5) * W * 0.6, r = 0.05 + h3 * 0.06;
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, rr = r * (0.7 + hash(id + k * 11 + i) * 0.6); pts.push(Q(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr, z)); }
    pushA(ctx, 0.55); poly(ctx, pts, shade(col, 0.62)); popA(ctx);
  }
}

// ---------- 履帶 ----------
function drawTrack(ctx, Q, u, L, tw, yc, th, sd) {
  const y0 = yc - tw / 2, y1 = yc + tw / 2;
  const bot = [[L * 0.42, y0], [L * 0.42, y1], [-L * 0.44, y1], [-L * 0.44, y0]];
  const top = rect(-L / 2, y0, L / 2, y1);
  prism(ctx, Q, bot, top, 0, th, '#4a4b45', '#55564f', { edge: false });
  // 履帶節
  const sp = 0.05, off = ((u.anim || 0) * 0.05) % sp;
  pushA(ctx, 0.9);
  for (let lx = -L / 2 + off; lx < L / 2; lx += sp) line(ctx, Q(lx, y0, th), Q(lx, y1, th), '#26271f', 0.35);
  popA(ctx);
  // 外側負重輪
  const ly = sd > 0 ? y1 : y0;
  if (sideVisible(Q, sd)) {
    for (let lx = -L / 2 + off * 1.2; lx < L * 0.44; lx += sp) line(ctx, Q(lx, ly, th * 0.1), Q(lx + 0.012, ly, th * 0.95), 'rgba(0,0,0,0.35)', 0.25);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const lx = -L * 0.34 + i * (L * 0.68 / (n - 1));
      const [wx, wy] = Q(lx, ly + sd * 0.004, th * 0.42);
      const r = th * 0.34;
      ell(ctx, wx, wy, r * 0.95, r * 1.05, '#202120');
      ell(ctx, wx, wy, r * 0.78, r * 0.88, '#6b6d66');
      ell(ctx, wx, wy, r * 0.42, r * 0.48, '#4a4b46');
      circ(ctx, wx - 0.15, wy - 0.15, r * 0.18, '#9a9c95');
    }
    for (const lx of [L * 0.44, -L * 0.45]) {
      const [wx, wy] = Q(lx, ly + sd * 0.004, th * 0.55);
      ell(ctx, wx, wy, th * 0.26, th * 0.3, '#3a3b37'); circ(ctx, wx, wy, th * 0.1, '#888');
    }
  }
}

// ---------- 主戰車 ----------
function drawTank(ctx, u, col) {
  const lk = u.def.look, L = lk.L, W = lk.W, H = lk.H;
  const bob = u.moving ? Math.sin(u.anim * 3) * 0.25 : 0;
  const Q = lframe(u.x, u.y, u.dir);
  const tw = W * 0.26, th = H * 0.62;
  shadowPoly(ctx, Q, rect(-L / 2 - 0.04, -W / 2 - 0.02, L / 2 + 0.04, W / 2 + 0.02));
  const sides = [-1, 1].map(sd => { const yc = sd * (W / 2 - tw / 2); return { sd, yc, d: -yc * Q.s + yc * Q.c }; }).sort((a, b) => a.d - b.d);
  for (const t of sides) drawTrack(ctx, Q, u, L, tw, t.yc, th, t.sd);
  const z0 = th * 0.4 + bob, z1 = th + H * 0.58 + bob;
  const hullCol = shade(col, 0.92);
  const isEP = u.def.faction === 'ep';
  // 車體(前方斜裝甲)
  const bot = rect(-L * 0.5, -W * 0.5, L * 0.48, W * 0.5);
  const top = isEP ? rect(-L * 0.46, -W * 0.45, L * 0.26, W * 0.45) : rect(-L * 0.44, -W * 0.42, L * 0.18, W * 0.42);
  prism(ctx, Q, bot, top, z0, z1, hullCol, col, { outline: true });
  // 側裙板接縫
  for (const sd of [-1, 1]) if (sideVisible(Q, sd)) {
    for (let k = 1; k < 5; k++) { const lx = -L * 0.5 + k * L * 0.2; line(ctx, Q(lx, sd * W * 0.5, z0), Q(lx - 0.01, sd * W * (isEP ? 0.45 : 0.42), z1), 'rgba(0,0,0,0.3)', 0.25); }
    line(ctx, Q(-L * 0.5, sd * W * 0.5, z0 + 0.4), Q(L * 0.48, sd * W * 0.5, z0 + 0.4), 'rgba(255,255,255,0.18)', 0.25);
  }
  camo(ctx, Q, u.id, L * 0.6, W * 0.8, z1, col);
  // 引擎蓋散熱格柵
  for (let k = 0; k < 6; k++) { const lx = -L * 0.42 + k * 0.025; line(ctx, Q(lx, -W * 0.28, z1), Q(lx, W * 0.28, z1), 'rgba(0,0,0,0.45)', 0.25); }
  // 工具箱、拖纜
  prism(ctx, Q, rect(-L * 0.3, W * 0.3, -L * 0.05, W * 0.4), rect(-L * 0.3, W * 0.3, -L * 0.05, W * 0.4), z1, z1 + 0.8, '#4a4b44');
  line(ctx, Q(-L * 0.2, -W * 0.38, z1 + 0.2), Q(L * 0.05, -W * 0.38, z1 + 0.2), '#2b2a26', 0.4);
  // 駕駛艙口
  const [hx, hy] = Q(L * 0.12, W * 0.18, z1);
  ell(ctx, hx, hy, 1.3, 0.7, shade(col, 0.6)); ell(ctx, hx - 0.1, hy - 0.1, 0.9, 0.45, shade(col, 0.85));
  // 頭燈 / 尾燈
  if (frontVisible(Q)) for (const sd of [-1, 1]) { const [lx, ly] = Q(L * 0.46, sd * W * 0.36, z0 + (z1 - z0) * 0.3); lamp(ctx, lx, ly, '#fff2b0', 0.45); }
  else for (const sd of [-1, 1]) { const [lx, ly] = Q(-L * 0.5, sd * W * 0.38, z0 + (z1 - z0) * 0.5); lamp(ctx, lx, ly, '#ff3020', 0.35, true); }
  // 排煙
  if (u.moving && Math.random() < 0.15) { const c = Q.cx - Q.c * L * 0.5, d = Q.cy - Q.s * L * 0.5; G.effects.push({ k: 'smoke', x: c, y: d, z: z1, t: 0, dur: 0.9 }); }
  drawTurret(ctx, u, col, Q, z1, L, W);
}

function drawTurret(ctx, u, col, Q, tz, L, W) {
  const lk = u.def.look;
  const tcx = Q.cx - Q.c * L * 0.06, tcy = Q.cy - Q.s * L * 0.06;
  const T = lframe(tcx, tcy, u.tdir);
  const rec = u.weapon && u.cool > u.weapon.rof - 0.15 ? -0.06 : 0;
  const s = W / 0.7;
  const sc = pts => pts.map(([a, b]) => [a * s, b * s]);
  switch (lk.tur) {
    case 'cannon': {
      // 雷神:六角形砲塔、附加反應裝甲
      const bot = sc([[0.24, -0.12], [0.24, 0.12], [0.08, 0.22], [-0.2, 0.21], [-0.26, 0], [-0.2, -0.21], [0.08, -0.22]]);
      const top = sc([[0.2, -0.1], [0.2, 0.1], [0.06, 0.18], [-0.18, 0.18], [-0.23, 0], [-0.18, -0.18], [0.06, -0.18]]);
      prism(ctx, T, bot, top, tz, tz + 4.6, shade(col, 0.85), shade(col, 1.02), { outline: true });
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
        const lx = (0.16 - k * 0.07) * s, ly = sd * (0.165 - k * 0.012) * s;
        prism(ctx, T, rect(lx - 0.03, ly - 0.025, lx + 0.03, ly + 0.025), rect(lx - 0.025, ly - 0.02, lx + 0.025, ly + 0.02), tz + 4.6, tz + 5.4, shade(col, 0.75));
      }
      prism(ctx, T, rect(0.18 * s, -0.07, 0.3 * s, 0.07), rect(0.18 * s, -0.06, 0.28 * s, 0.06), tz + 0.8, tz + 3.8, shade(col, 0.7));
      const bx0 = 0.28 * s + rec, bx1 = (0.28 * s + L * 0.62) + rec;
      barrel(ctx, T, bx0, bx1, 0, tz + 2.3, 0.045, '#5a5c55');
      const [ex, ey] = T(bx0 + (bx1 - bx0) * 0.45, 0, tz + 2.3); ell(ctx, ex, ey, 1.3, 1.3, '#4a4c46');
      prism(ctx, T, rect(bx1 - 0.06, -0.045, bx1, 0.045), rect(bx1 - 0.06, -0.04, bx1, 0.04), tz + 1.5, tz + 3.1, '#3a3c37');
      // 車長塔、天線、煙霧彈
      isoCyl(ctx, ...pt(T, -0.08 * s, -0.09 * s), 0.07, tz + 4.6, tz + 6.2, shade(col, 0.8));
      const [cx2, cy2] = T(-0.08 * s, -0.09 * s, tz + 6.2); ell(ctx, cx2 + 0.4, cy2 - 0.2, 1.1, 0.55, '#2a2b28');
      barrel(ctx, T, -0.05 * s, 0.05 * s, 0.13 * s, tz + 5.2, 0.012, '#333');
      antenna(ctx, T, -0.2 * s, 0.12 * s, tz + 4.6, 13, u.id);
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const [px, py] = T(0.1 * s, sd * (0.2 + k * 0.025) * s, tz + 3.4); circ(ctx, px, py, 0.45, '#2f302c'); }
      break;
    }
    case 'laser': {
      // 赫利俄斯:流線型砲塔 + 線圈雷射
      const n = 10, bot = [], top = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283, rx = Math.cos(a) > 0 ? 0.22 : 0.2, ry = 0.17;
        bot.push([Math.cos(a) * rx * s, Math.sin(a) * ry * s]); top.push([Math.cos(a) * rx * s * 0.82, Math.sin(a) * ry * s * 0.78]);
      }
      prism(ctx, T, bot, top, tz, tz + 4, shade(col, 0.88), shade(col, 1.08), { outline: true });
      // 感測器圓頂
      const [dx, dy] = T(-0.06 * s, 0.06 * s, tz + 4);
      ctx.fillStyle = vgrad(ctx, dy, dy - 2, '#203040', '#7fb8e8'); ctx.beginPath(); ctx.ellipse(dx, dy, 1.5, 1.5, 0, Math.PI, 0); ctx.fill();
      circ(ctx, dx - 0.5, dy - 0.9, 0.35, '#e8f6ff');
      const bx0 = 0.18 * s + rec, bx1 = 0.18 * s + L * 0.5 + rec;
      barrel(ctx, T, bx0, bx1, 0, tz + 2.2, 0.05, '#6a6f78');
      const beam = FACTIONS.ac.beam, charge = u.weapon ? clamp(1 - u.cool / u.weapon.rof, 0, 1) : 1;
      for (let k = 0; k < 4; k++) {
        const [cx, cy] = T(bx0 + (bx1 - bx0) * (0.2 + k * 0.18), 0, tz + 2.2);
        ell(ctx, cx, cy, 1.1, 1.3, '#2a2d33');
        pushA(ctx, 0.4 + 0.6 * charge); ell(ctx, cx, cy, 0.7, 0.9, beam); popA(ctx);
      }
      const [lx, ly] = T(bx1, 0, tz + 2.2);
      glow(ctx, lx, ly, 3 + charge * 2, beam, 0.5 + 0.4 * charge); circ(ctx, lx, ly, 0.7, '#ffe0e4');
      antenna(ctx, T, -0.17 * s, -0.1 * s, tz + 4, 11, u.id);
      break;
    }
    case 'lance': {
      // 日冕光束砲:轉台 + 舉升臂 + 聚焦碟
      isoCyl(ctx, ...pt(T, -0.08, 0), 0.2, tz, tz + 2, '#70757d');
      prism(ctx, T, rect(-0.2, -0.08, 0.05, 0.08), rect(-0.1, -0.06, 0.08, 0.06), tz + 2, tz + 9, '#878d96');
      for (let k = 0; k < 4; k++) line(ctx, T(-0.18 + k * 0.03, 0.081, tz + 3), T(-0.14 + k * 0.03, 0.081, tz + 7), '#555', 0.3);
      const [ex, ey] = T(0.08, 0, tz + 11);
      ctx.save(); ctx.translate(ex, ey);
      const facing = Math.cos(u.tdir) - Math.sin(u.tdir);
      ctx.scale(0.55 + 0.45 * Math.abs(facing), 1);
      const g = ctx.createRadialGradient(-1, -1, 0, 0, 0, 6);
      g.addColorStop(0, '#f0f4f8'); g.addColorStop(0.7, '#9aa3ad'); g.addColorStop(1, '#5a626c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 6, 5, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#3a4048'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.ellipse(0, 0, 4, 3.3, 0, 0, 6.283); ctx.stroke();
      ctx.restore();
      const charge = u.weapon ? clamp(1 - u.cool / u.weapon.rof, 0, 1) : 1;
      const [fx, fy] = T(0.25, 0, tz + 11.5);
      line(ctx, [ex, ey], [fx, fy], '#666', 0.5);
      glow(ctx, fx, fy, 2 + 4 * charge, FACTIONS.ac.beam, 0.9);
      poly(ctx, [[fx, fy - 1.6], [fx + 0.9, fy], [fx, fy + 1.6], [fx - 0.9, fy]], '#ffd0d8');
      break;
    }
    case 'rail': {
      // 軌道砲:電容艙 + 雙軌
      prism(ctx, T, rect(-0.28, -0.16, 0.08, 0.16), rect(-0.26, -0.14, 0.05, 0.14), tz, tz + 4, shade(col, 0.82), shade(col, 1.0), { outline: true });
      for (let k = 0; k < 3; k++) {
        const [cx, cy] = T(-0.22 + k * 0.09, -0.14, tz + 4);
        const lit = (G.time * 3 + k + u.id) % 3 < 1.5;
        prism(ctx, T, rect(-0.25 + k * 0.09, -0.12, -0.18 + k * 0.09, -0.04), rect(-0.25 + k * 0.09, -0.12, -0.18 + k * 0.09, -0.04), tz + 4, tz + 5.2, '#3a4048', lit ? '#7fd8ff' : '#456070');
        void cx; void cy;
      }
      const charge = u.weapon ? clamp(1 - u.cool / u.weapon.rof, 0, 1) : 1;
      for (const sd of [-1, 1]) {
        prism(ctx, T, rect(-0.05, sd * 0.08 - 0.022, 0.9 + rec, sd * 0.08 + 0.022), rect(-0.05, sd * 0.08 - 0.018, 0.9 + rec, sd * 0.08 + 0.018), tz + 2.6, tz + 3.8, '#7d8590', '#a9b2bc');
      }
      for (let k = 0; k < 8; k++) {
        const [cx, cy] = T(0.05 + k * 0.1, 0, tz + 3.2);
        pushA(ctx, 0.3 + 0.7 * charge * (0.5 + 0.5 * Math.sin(G.time * 12 - k))); glow(ctx, cx, cy, 1.6, '#9fe3ff', 0.9); popA(ctx);
      }
      break;
    }
    case 'mg': {
      prism(ctx, T, rect(-0.1, -0.09, 0.1, 0.09), rect(-0.08, -0.07, 0.07, 0.07), tz, tz + 2.8, '#5a5f58', '#70766e', { outline: true });
      for (const sd of [-1, 1]) barrel(ctx, T, 0.08 + rec * 0.5, 0.36 + rec * 0.5, sd * 0.03, tz + 1.6, 0.015, '#333');
      const [sx, sy] = T(-0.02, 0.09, tz + 3.2);
      pix(ctx, sx - 0.8, sy - 0.8, 1.6, 1.4, '#2a2e33'); circ(ctx, sx + 0.3, sy - 0.1, 0.35, '#8fd0ff');
      break;
    }
  }
}
function pt(Q, lx, ly) { const c = Q.c, s = Q.s; return [Q.cx + lx * c - ly * s, Q.cy + lx * s + ly * c]; }
function antenna(ctx, Q, lx, ly, z, h, id) {
  const [ax, ay] = Q(lx, ly, z);
  const sway = Math.sin(G.time * 2.3 + id) * 1.2;
  ctx.strokeStyle = '#222'; ctx.lineWidth = 0.25;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax + sway * 0.3, ay - h * 0.6, ax + sway, ay - h); ctx.stroke();
  circ(ctx, ax + sway, ay - h, 0.3, '#444');
}

// ---------- 輪式車 ----------
function drawWheeled(ctx, u, col) {
  const lk = u.def.look, L = lk.L, W = lk.W, H = lk.H;
  const isEP = u.def.faction === 'ep';
  const bob = u.moving ? Math.sin(u.anim * 4) * 0.3 : 0;
  const Q = lframe(u.x, u.y, u.dir);
  shadowPoly(ctx, Q, rect(-L / 2, -W / 2 - 0.02, L / 2, W / 2 + 0.02));
  const axles = isEP ? [-0.32, 0, 0.32] : [-0.3, 0.3];
  const wheel = (lx, sd) => {
    const [wx, wy] = Q(lx * L, sd * W * 0.47, 2);
    const spin = (u.anim || 0) * 2;
    ell(ctx, wx, wy, 1.7, 2.1, '#151614');
    ell(ctx, wx, wy, 1.0, 1.25, '#5a5c58');
    for (let k = 0; k < 3; k++) { const a = spin + k * 2.09; line(ctx, [wx, wy], [wx + Math.cos(a) * 0.9, wy + Math.sin(a) * 1.1], '#2a2b29', 0.25); }
    circ(ctx, wx, wy, 0.35, '#999');
  };
  const near = sideVisible(Q, 1) ? 1 : -1;
  for (const a of axles) wheel(a, -near);
  const z0 = 1.6 + bob, z1 = z0 + H * 0.6;
  // 下車體(楔形車頭)
  const bot = rect(-L * 0.5, -W * 0.44, L * 0.5, W * 0.44);
  const top = isEP ? rect(-L * 0.48, -W * 0.42, L * 0.36, W * 0.42) : rect(-L * 0.46, -W * 0.38, L * 0.26, W * 0.38);
  prism(ctx, Q, bot, top, z0, z1, shade(col, 0.9), col, { outline: true });
  camo(ctx, Q, u.id, L * 0.5, W * 0.6, z1, col);
  // 駕駛艙
  const cb = isEP ? rect(-L * 0.05, -W * 0.36, L * 0.3, W * 0.36) : rect(-L * 0.1, -W * 0.32, L * 0.2, W * 0.32);
  const ct = isEP ? rect(-L * 0.05, -W * 0.33, L * 0.2, W * 0.33) : rect(-L * 0.12, -W * 0.27, L * 0.08, W * 0.27);
  const cab = prism(ctx, Q, cb, ct, z1, z1 + 2.6, shade(col, 0.8), shade(col, 0.95));
  // 車窗
  if (frontVisible(Q)) {
    const fx0 = cb[0][0], fx1 = ct[0][0];
    const gl = [Q(fx0, -W * 0.3, z1 + 0.5), Q(fx0, W * 0.3, z1 + 0.5), Q(fx1, W * 0.25, z1 + 2.3), Q(fx1, -W * 0.25, z1 + 2.3)];
    poly(ctx, gl, vgrad(ctx, gl[0][1], gl[3][1], '#162028', '#5d86a8'));
    line(ctx, gl[0], gl[3], 'rgba(255,255,255,0.35)', 0.3);
  }
  for (const sd of [-1, 1]) if (sideVisible(Q, sd)) {
    const yy = sd * (isEP ? 0.36 : 0.32) * W;
    const gl = [Q(cb[2][0] + 0.03, yy, z1 + 0.7), Q(cb[0][0] - 0.03, yy, z1 + 0.7), Q(ct[0][0] - 0.02, yy * 0.92, z1 + 2.2), Q(ct[2][0] + 0.02, yy * 0.92, z1 + 2.2)];
    poly(ctx, gl, vgrad(ctx, gl[0][1], gl[3][1], '#1a2630', '#4f7696'));
  }
  void cab;
  // 備胎、車燈
  if (isEP) { const [sx, sy] = Q(-L * 0.5, 0, z0 + 2); ell(ctx, sx, sy, 1.3, 1.6, '#1a1a18'); circ(ctx, sx, sy, 0.5, '#666'); }
  if (frontVisible(Q)) for (const sd of [-1, 1]) { const [lx, ly] = Q(L * 0.5, sd * W * 0.32, z0 + 1); lamp(ctx, lx, ly, '#fff2b0', 0.4); }
  for (const a of axles) wheel(a, near);
  // 遙控武器站
  const T0 = lframe(Q.cx - Q.c * L * 0.25, Q.cy - Q.s * L * 0.25, u.dir);
  drawTurret(ctx, u, col, T0, isEP ? z1 + 0.2 : z1, 0, W);
  antenna(ctx, Q, -L * 0.42, W * 0.3, z1, 10, u.id);
}

// ---------- 採集車 ----------
function drawHarvester(ctx, u, col) {
  const lk = u.def.look, L = lk.L, W = lk.W;
  const Q = lframe(u.x, u.y, u.dir);
  const yel = '#d9a92a';
  shadowPoly(ctx, Q, rect(-L / 2 - 0.05, -W / 2, L / 2 + 0.1, W / 2));
  const tw = W * 0.22, th = 3.4;
  const sides = [-1, 1].map(sd => { const yc = sd * (W / 2 - tw / 2); return { sd, yc, d: -yc * Q.s + yc * Q.c }; }).sort((a, b) => a.d - b.d);
  for (const t of sides) drawTrack(ctx, Q, u, L * 0.95, tw, t.yc, th, t.sd);
  const z0 = 2.2, z1 = 6;
  // 底盤
  prism(ctx, Q, rect(-L * 0.5, -W * 0.5, L * 0.42, W * 0.5), rect(-L * 0.48, -W * 0.48, L * 0.4, W * 0.48), z0, z1, '#5a5650', '#6a665e');
  // 前方採礦滾筒
  const drumX = L * 0.5;
  prism(ctx, Q, rect(drumX - 0.08, -W * 0.48, drumX + 0.06, W * 0.48), rect(drumX - 0.06, -W * 0.46, drumX + 0.04, W * 0.46), 0.6, 3.8, '#6c6a64', '#8a877f');
  const spin = (u.anim || 0) * 3;
  for (let k = 0; k < 8; k++) {
    const ly = -W * 0.44 + k * W * 0.88 / 7;
    const zz = 2.2 + Math.sin(spin + k) * 1.4;
    const [tx, ty] = Q(drumX + 0.07, ly, zz);
    poly(ctx, [[tx - 0.5, ty], [tx + 0.8, ty - 0.4], [tx, ty + 0.6]], '#c8c4b8');
  }
  // 液壓臂
  for (const sd of [-1, 1]) line(ctx, Q(L * 0.2, sd * W * 0.42, z1), Q(drumX - 0.02, sd * W * 0.42, 3), '#3a3834', 0.7);
  // 駕駛艙
  const cb = rect(L * 0.12, -W * 0.46, L * 0.4, -W * 0.02), ct = rect(L * 0.12, -W * 0.44, L * 0.32, -W * 0.05);
  prism(ctx, Q, cb, ct, z1, z1 + 5, yel, shade(yel, 1.1), { outline: true });
  if (frontVisible(Q)) {
    const g = [Q(L * 0.4, -W * 0.43, z1 + 1.8), Q(L * 0.4, -W * 0.05, z1 + 1.8), Q(L * 0.32, -W * 0.07, z1 + 4.6), Q(L * 0.32, -W * 0.42, z1 + 4.6)];
    poly(ctx, g, vgrad(ctx, g[0][1], g[3][1], '#152230', '#6a98c0'));
  }
  if (sideVisible(Q, -1)) {
    const g = [Q(L * 0.15, -W * 0.46, z1 + 1.8), Q(L * 0.38, -W * 0.46, z1 + 1.8), Q(L * 0.31, -W * 0.44, z1 + 4.4), Q(L * 0.16, -W * 0.44, z1 + 4.4)];
    poly(ctx, g, vgrad(ctx, g[0][1], g[3][1], '#152230', '#557fa5'));
  }
  // 警示燈
  const blink = (u.moving || u.hstate === 'harvest' || u.hstate === 'unload') && Math.sin(G.time * 9) > 0;
  const [bx, by] = Q(L * 0.25, -W * 0.25, z1 + 5.6);
  lamp(ctx, bx, by, '#ffa020', 0.6, blink);
  // 礦斗
  const hb = rect(-L * 0.48, -W * 0.46, L * 0.08, W * 0.46), ht = rect(-L * 0.5, -W * 0.5, L * 0.1, W * 0.5);
  const hop = prism(ctx, Q, hb, ht, z1, z1 + 4.6, yel, '#3a3630', { outline: true });
  // 斗內
  const inner = rect(-L * 0.46, -W * 0.44, L * 0.06, W * 0.44).map(p => Q(p[0], p[1], z1 + 4.6));
  poly(ctx, inner, vgrad(ctx, inner[2][1], inner[0][1], '#5a5246', '#2e2a24'));
  const fill = clamp((u.cargo || 0) / HARV_CAP, 0, 1);
  if (fill > 0.03) {
    const [ox, oy] = Q(-L * 0.2, 0, z1 + 4.6 + fill * 2.5);
    const g = ctx.createRadialGradient(ox - 1, oy - 1, 0, ox, oy, 7);
    g.addColorStop(0, '#ffe08a'); g.addColorStop(0.6, '#d49a30'); g.addColorStop(1, '#8a5a18');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ox, oy + 0.8, 5.5 * Math.min(1, fill + 0.4), 2.6 * Math.min(1, fill + 0.4), 0, 0, 6.283); ctx.fill();
    for (let k = 0; k < 6; k++) circ(ctx, ox + (hash(u.id + k) - 0.5) * 6, oy + (hash(u.id * 3 + k) - 0.5) * 2, 0.5, '#fff0b0');
  }
  // 側邊團隊色條紋與警示斜紋
  for (const sd of [-1, 1]) if (sideVisible(Q, sd)) {
    const yy = sd * W * 0.48;
    poly(ctx, [Q(-L * 0.48, yy, z1 + 1.2), Q(L * 0.08, yy, z1 + 1.2), Q(L * 0.08, yy, z1 + 2.4), Q(-L * 0.48, yy, z1 + 2.4)], col);
    for (let k = 0; k < 6; k++) {
      const a = -L * 0.48 + k * 0.09;
      poly(ctx, [Q(a, yy, z1 + 3), Q(a + 0.04, yy, z1 + 3), Q(a + 0.07, yy, z1 + 4.2), Q(a + 0.03, yy, z1 + 4.2)], '#1a1a1a');
    }
  }
  void hop;
  if (u.hstate === 'harvest' && Math.random() < 0.3) {
    const [fx, fy] = [Q.cx + Q.c * L * 0.55, Q.cy + Q.s * L * 0.55];
    G.effects.push({ k: 'part', x: fx, y: fy, z: 2, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, vz: 20 + Math.random() * 20, c: '#e0a83a', t: 0, dur: 0.5 });
  }
}

// ---------- 步兵 ----------
function drawSoldier(ctx, u, col) {
  const [sx, sy] = P(u.x, u.y, 0);
  const gun = u.def.look.gun;
  const isAC = u.def.faction === 'ac';
  const fx = Math.cos(u.dir) - Math.sin(u.dir), fy = (Math.cos(u.dir) + Math.sin(u.dir)) / 2;
  const fl = Math.hypot(fx, fy) || 1, dx = fx / fl, dy = fy / fl;
  const away = dy < -0.15;
  const walk = u.moving ? Math.sin(u.anim * 2) : 0;
  const breathe = Math.sin(G.time * 2 + u.id) * 0.15;
  const fat = isAC ? '#4a5560' : '#55583f', dark = shade(fat, 0.65), skin = '#d8a984';
  softShadow(ctx, u.x, u.y, 4, 1.8, 0.4);
  // 腿與靴
  const hipY = sy - 5.2;
  for (const sd of [-1, 1]) {
    const sw = walk * sd;
    const kx = sx + sd * 0.8 + dx * sw * 0.6, ky = hipY + 2.6;
    const fx2 = sx + sd * 0.9 + dx * sw * 1.6, fy2 = sy - 0.4 + dy * sw * 0.5 - Math.max(0, sw) * 0.6;
    ctx.lineCap = 'round';
    line(ctx, [sx + sd * 0.7, hipY], [kx, ky], sd > 0 ? fat : dark, 1.3);
    line(ctx, [kx, ky], [fx2, fy2], sd > 0 ? fat : dark, 1.15);
    ctx.lineCap = 'butt';
    ell(ctx, fx2 + dx * 0.4, fy2 + 0.2, 0.9, 0.5, '#1b1a18');
  }
  const bodyTop = sy - 10.2 + breathe;
  const drawPack = () => {
    const bx = sx - dx * 1.6, by = bodyTop + 1.2;
    ctx.fillStyle = shade(fat, 0.75); ctx.beginPath(); ctx.roundRect(bx - 1.6, by, 3.2, 4, 0.6); ctx.fill();
    pix(ctx, bx - 1.6, by + 0.6, 3.2, 0.4, shade(fat, 0.5));
    if (gun === 'none') { line(ctx, [bx + 0.8, by], [bx + 0.8, by - 3], '#777', 0.25); circ(ctx, bx + 0.8, by - 3, 0.3, '#f44'); }
  };
  const drawWeapon = () => {
    const hx = sx + dx * 1.4, hy = bodyTop + 3.2 + dy * 0.6;
    if (gun === 'rocket') {
      // 肩扛式導彈發射器
      const ax = sx + dx * 0.4, ay = bodyTop + 1.2;
      const tx = ax + dx * 6.5, ty = ay + dy * 3.2 - 0.3;
      const bx2 = ax - dx * 3, by2 = ay - dy * 1.5;
      ctx.lineCap = 'round'; line(ctx, [bx2, by2], [tx, ty], '#4f5a38', 2); line(ctx, [bx2, by2 - 0.5], [tx, ty - 0.5], '#6f7c50', 0.6); ctx.lineCap = 'butt';
      circ(ctx, tx, ty, 1.05, '#2a2e22'); circ(ctx, tx, ty, 0.55, '#111');
      pix(ctx, ax + dx * 1.5 - 0.6, ay - 1.6, 1.2, 1, '#333');
      return;
    }
    if (gun === 'none') {
      // 工程師工具箱
      ctx.fillStyle = '#b02a20'; ctx.fillRect(hx - 1.2, hy + 1, 2.4, 1.6);
      pix(ctx, hx - 0.5, hy + 0.5, 1, 0.5, '#222');
      return;
    }
    const L1 = gun === 'laser' ? 6.2 : 5.6;
    const tx = hx + dx * L1 * 0.65, ty = hy + dy * L1 * 0.35 - 0.6;
    const bx2 = hx - dx * L1 * 0.35, by2 = hy - dy * L1 * 0.15 + 0.2;
    ctx.lineCap = 'round';
    line(ctx, [bx2, by2], [tx, ty], gun === 'laser' ? '#7a8088' : '#2a2b2a', gun === 'laser' ? 1.2 : 0.9);
    ctx.lineCap = 'butt';
    pix(ctx, hx - 0.4 + dx * 0.6, hy + 0.2, 0.8, 1.4, '#1c1c1c');
    if (gun === 'laser') {
      for (let k = 0; k < 3; k++) circ(ctx, bx2 + (tx - bx2) * (0.35 + k * 0.17), by2 + (ty - by2) * (0.35 + k * 0.17), 0.45, FACTIONS.ac.beam);
      glow(ctx, tx, ty, 2.2, FACTIONS.ac.beam, 0.6);
    } else line(ctx, [tx, ty], [tx + dx * 1.2, ty + dy * 0.6], '#111', 0.45);
    if (u.weapon && u.cool > u.weapon.rof - 0.08) { glow(ctx, tx + dx * 1.5, ty + dy * 0.7, 3.5, '#fff0a0', 1); circ(ctx, tx + dx * 1.5, ty + dy * 0.7, 0.8, '#fff'); }
  };
  if (!away) drawPack(); else drawWeapon();
  // 軀幹(作戰服 + 防彈背心)
  ctx.fillStyle = vgrad(ctx, bodyTop + 5.5, bodyTop, shade(fat, 0.8), fat);
  ctx.beginPath(); ctx.roundRect(sx - 2, bodyTop, 4, 5.4, 1); ctx.fill();
  ctx.fillStyle = vgrad(ctx, bodyTop + 4.5, bodyTop + 0.6, shade(col, 0.7), col);
  ctx.beginPath(); ctx.roundRect(sx - 1.7, bodyTop + 0.6, 3.4, 3.8, 0.7); ctx.fill();
  pix(ctx, sx - 1.7, bodyTop + 4.2, 3.4, 0.5, '#2a2620');
  for (let k = 0; k < 3; k++) pix(ctx, sx - 1.4 + k * 1.05, bodyTop + 2.6, 0.75, 1.1, shade(col, 0.55));
  pix(ctx, sx - 1.9, bodyTop + 0.6, 0.4, 3.8, 'rgba(255,255,255,0.18)');
  // 手臂
  const shY = bodyTop + 1.1;
  ctx.lineCap = 'round';
  line(ctx, [sx - 1.8, shY], [sx - 1.2 + dx * 1.6, shY + 2.6 + dy], dark, 1);
  line(ctx, [sx + 1.8, shY], [sx + 0.9 + dx * 2.2, shY + 2.2 + dy], fat, 1);
  ctx.lineCap = 'butt';
  // 頭部與頭盔
  const hy = bodyTop - 1.8;
  circ(ctx, sx + dx * 0.2, hy, 1.35, skin);
  if (gun === 'none') {
    ctx.fillStyle = '#f2c22a'; ctx.beginPath(); ctx.ellipse(sx + dx * 0.2, hy - 0.4, 1.8, 1.4, 0, Math.PI, 0); ctx.fill();
    pix(ctx, sx - 1.9 + dx * 0.2, hy - 0.5, 3.8, 0.4, '#d8a818');
  } else {
    const hc = shade(col, 0.5);
    ctx.fillStyle = vgrad(ctx, hy, hy - 1.8, hc, shade(col, 0.8));
    ctx.beginPath(); ctx.ellipse(sx + dx * 0.2, hy - 0.35, 1.75, 1.55, 0, Math.PI, 0); ctx.fill();
    pix(ctx, sx - 1.8 + dx * 0.2, hy - 0.45, 3.6, 0.45, shade(hc, 0.7));
    if (!away) {
      // 面罩:聯盟為發光藍色,協約為暗色護目鏡
      const vx = sx + dx * 0.8, vy = hy + 0.2;
      if (isAC) { glow(ctx, vx, vy, 1.8, '#5fe0ff', 0.5); pix(ctx, vx - 1, vy - 0.3, 2, 0.6, '#9ff0ff'); }
      else pix(ctx, vx - 1, vy - 0.35, 2, 0.7, '#1a1a18');
    }
  }
  if (!away) drawWeapon(); else drawPack();
}

// ---------- 單位入口 ----------
function drawUnit(ctx, u) {
  const lk = u.def.look, col = G.players[u.owner].color;
  if (FACTIONS[G.players[u.owner].faction].era === 'ming') { drawUnitMing(ctx, u, col); return; }
  if (lk.kind === 'inf') { drawSoldier(ctx, u, col); return; }
  if (lk.kind === 'harv') { drawHarvester(ctx, u, col); return; }
  if (lk.wheels) { drawWheeled(ctx, u, col); return; }
  drawTank(ctx, u, col);
}

// ========== 建築零件 ==========
const FSW = (xa, xb, yf) => (u, z) => P(xa + (xb - xa) * u, yf, z);
const FSE = (xf, ya, yb) => (u, z) => P(xf, ya + (yb - ya) * u, z);
function faceQuad(F, u0, u1, z0, z1) { return [F(u0, z0), F(u1, z0), F(u1, z1), F(u0, z1)]; }
function windows(ctx, F, cols, rows, z0, z1, seed, opt = {}) {
  const mu = opt.mu ?? 0.2, mz = opt.mz ?? 0.22, lit = opt.lit ?? 0.25;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const u0 = (c + mu) / cols, u1 = (c + 1 - mu) / cols;
    const za = z0 + (z1 - z0) * (r + mz) / rows, zb = z0 + (z1 - z0) * (r + 1 - mz) / rows;
    const q = faceQuad(F, u0, u1, za, zb);
    const on = hash(seed * 97 + c * 13 + r * 7) < lit;
    poly(ctx, q, on ? vgrad(ctx, q[0][1], q[3][1], '#ffcf70', '#fff0c0') : vgrad(ctx, q[0][1], q[3][1], opt.glassB || '#16212b', opt.glassT || '#4a6a88'));
    if (!on) poly(ctx, [q[3], F(u0 + (u1 - u0) * 0.45, zb), F(u0, za + (zb - za) * 0.4)], 'rgba(255,255,255,0.13)');
    pushA(ctx, 0.5); polyStroke(ctx, q, '#1a1d20', 0.3); popA(ctx);
  }
}
function band(ctx, F, z0, z1, col, u0 = 0, u1 = 1) { poly(ctx, faceQuad(F, u0, u1, z0, z1), col); }
function seams(ctx, F, n, z0, z1, col = 'rgba(0,0,0,0.22)') { for (let k = 1; k < n; k++) line(ctx, F(k / n, z0), F(k / n, z1), col, 0.3); }
function hazard(ctx, F, z0, z1, n, u0 = 0, u1 = 1) {
  band(ctx, F, z0, z1, '#e8c020', u0, u1);
  const st = (u1 - u0) / n;
  for (let k = 0; k < n - 1; k += 2) {
    const a = u0 + st * k, m = a + st, b = Math.min(u1, a + st * 2);
    poly(ctx, [F(a, z0), F(m, z0), F(b, z1), F(m, z1)], '#1c1c1c');
  }
}
function railing(ctx, x0, y0, x1, y1, z) {
  const pts = [[x0, y1], [x1, y1], [x1, y0]];
  for (let s = 0; s < 2; s++) {
    const [ax, ay] = pts[s], [bx, by] = pts[s + 1];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) * 5));
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n; line(ctx, P(x, y, z), P(x, y, z + 1.7), '#c8ccd0', 0.25); }
    line(ctx, P(ax, ay, z + 1.7), P(bx, by, z + 1.7), '#dfe3e6', 0.3);
    line(ctx, P(ax, ay, z + 0.9), P(bx, by, z + 0.9), '#aab0b6', 0.2);
  }
}
function acUnit(ctx, x, y, z, t) {
  isoBox(ctx, x, y, x + 0.28, y + 0.28, z, z + 2.2, '#9aa1a8', '#b6bcc2');
  const [cx, cy] = P(x + 0.14, y + 0.14, z + 2.2);
  ell(ctx, cx, cy, 2.6, 1.3, '#3a3f44');
  for (let k = 0; k < 3; k++) { const a = t * 8 + k * 2.09; line(ctx, [cx, cy], [cx + Math.cos(a) * 2.3, cy + Math.sin(a) * 1.1], '#7a8086', 0.4); }
}
function vent(ctx, x, y, w, z) {
  isoBox(ctx, x, y, x + w, y + w, z, z + 1.2, '#70767c', '#5a6066');
  for (let k = 1; k < 5; k++) line(ctx, P(x + w * k / 5, y + 0.02, z + 1.2), P(x + w * k / 5, y + w - 0.02, z + 1.2), '#2c3034', 0.3);
}
function pipe(ctx, a, b, w, col) {
  const pa = P(a[0], a[1], a[2]), pb = P(b[0], b[1], b[2]);
  ctx.lineCap = 'round';
  line(ctx, pa, pb, shade(col, 0.55), w); line(ctx, [pa[0], pa[1] - w * 0.25], [pb[0], pb[1] - w * 0.25], shade(col, 1.15), w * 0.35);
  ctx.lineCap = 'butt';
}
function blink(ctx, x, y, z, col, phase = 0, rate = 3) {
  const [lx, ly] = P(x, y, z);
  lamp(ctx, lx, ly, col, 0.55, Math.sin(G.time * rate + phase) > 0.2);
}
function slab(ctx, b, h, col) {
  const x0 = b.tx, y0 = b.ty, x1 = b.tx + b.w, y1 = b.ty + b.h;
  pushA(ctx, 0.3);
  poly(ctx, [P(x0 - 0.12, y0 - 0.12), P(x1 + 0.15, y0 - 0.12), P(x1 + 0.15, y1 + 0.15), P(x0 - 0.12, y1 + 0.15)], '#000');
  popA(ctx);
  isoBox(ctx, x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, 0, h, col, shade(col, 1.06));
  // 地面縫線
  for (let k = 1; k < b.w * 2; k++) line(ctx, P(x0 + k / 2, y0 + 0.04, h), P(x0 + k / 2, y1 - 0.04, h), 'rgba(0,0,0,0.12)', 0.25);
  for (let k = 1; k < b.h * 2; k++) line(ctx, P(x0 + 0.04, y0 + k / 2, h), P(x1 - 0.04, y0 + k / 2, h), 'rgba(0,0,0,0.12)', 0.25);
}
function flag(ctx, x, y, z0, h, col, t) {
  line(ctx, P(x, y, z0), P(x, y, z0 + h), '#d8dcdf', 0.4);
  const [fx, fy] = P(x, y, z0 + h);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(fx, fy);
  for (let k = 0; k <= 6; k++) ctx.lineTo(fx + k * 1.4, fy + Math.sin(t * 6 + k * 0.9) * 0.7 * k / 6);
  for (let k = 6; k >= 0; k--) ctx.lineTo(fx + k * 1.4, fy + 4.5 + Math.sin(t * 6 + k * 0.9) * 0.7 * k / 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(fx + 4.2, fy + 2.3 + Math.sin(t * 6 + 2.7) * 0.35, 1.1, 0, 6.283); ctx.fill();
}
function dish(ctx, x, y, z, r, ang) {
  const [cx, cy] = P(x, y, z);
  const sx = Math.abs(Math.cos(ang)) * 0.85 + 0.15;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, 1);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#c8ced4'); g.addColorStop(1, '#7a838c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.8, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#5a636c'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 0.48, 0, 0, 6.283); ctx.stroke();
  ctx.restore();
  line(ctx, [cx, cy], [cx + Math.cos(ang) * r * sx * 0.6, cy - r * 0.6], '#555', 0.3);
}

// ========== 建築 ==========
function drawBuilding(ctx, b) {
  const col = G.players[b.owner].color;
  const x0 = b.tx, y0 = b.ty, x1 = b.tx + b.w, y1 = b.ty + b.h;
  R.zs = b.prog < 1 ? b.prog : 1;
  const t = G.time + b.anim, seed = b.id * 7 + b.tx * 3 + b.ty;
  const conc = '#8e949b', p = G.players[b.owner], powered = !p.lowPower;
  if (FACTIONS[p.faction].era === 'ming') drawBuildingMing(ctx, b, col, t, seed, powered);
  else switch (b.type) {
    case 'conyard': {
      slab(ctx, b, 2.4, '#767c83');
      hazard(ctx, FSW(x0 + 0.04, x1 - 0.04, y1 - 0.04), 0.3, 2.1, 22);
      // 側翼車庫
      isoBox(ctx, x1 - 1.05, y0 + 0.25, x1 - 0.2, y1 - 1.25, 2.4, 11, '#868c93', '#9ea4ab');
      const gd = FSE(x1 - 0.2, y0 + 0.4, y1 - 1.4);
      band(ctx, gd, 2.4, 9, '#3a3e42', 0.12, 0.88);
      for (let k = 0; k < 6; k++) line(ctx, gd(0.12, 3.4 + k), gd(0.88, 3.4 + k), '#55595e', 0.3);
      hazard(ctx, gd, 9, 10, 10, 0.12, 0.88);
      // 主樓
      isoBox(ctx, x0 + 0.25, y0 + 0.25, x1 - 1.05, y1 - 0.85, 2.4, 21, '#9ba1a8', '#b4bac1');
      const sw = FSW(x0 + 0.25, x1 - 1.05, y1 - 0.85), se = FSE(x1 - 1.05, y0 + 0.25, y1 - 0.85);
      windows(ctx, sw, 5, 3, 4, 16.5, seed, { lit: 0.3 });
      windows(ctx, se, 6, 3, 4, 16.5, seed + 1, { lit: 0.3 });
      band(ctx, sw, 17.5, 19.5, col); band(ctx, se, 17.5, 19.5, shade(col, 0.75));
      // 入口
      band(ctx, sw, 2.4, 6.5, '#2c3236', 0.42, 0.62);
      poly(ctx, faceQuad(sw, 0.38, 0.66, 6.5, 7.3), shade(col, 0.9));
      // 塔台
      isoBox(ctx, x0 + 0.5, y0 + 0.5, x0 + 1.3, y0 + 1.3, 21, 28, '#a6acb3', '#c0c6cc');
      const tsw = FSW(x0 + 0.5, x0 + 1.3, y0 + 1.3), tse = FSE(x0 + 1.3, y0 + 0.5, y0 + 1.3);
      windows(ctx, tsw, 4, 1, 23, 27, seed + 2, { mu: 0.05, mz: 0.08, lit: 0, glassT: '#7ab0d8' });
      windows(ctx, tse, 4, 1, 23, 27, seed + 3, { mu: 0.05, mz: 0.08, lit: 0, glassT: '#6a9cc4' });
      isoBox(ctx, x0 + 0.45, y0 + 0.45, x0 + 1.35, y0 + 1.35, 28, 29, '#7a8087', '#8d939a');
      dish(ctx, x0 + 0.8, y0 + 0.8, 32, 3, t * 0.7);
      line(ctx, P(x0 + 0.8, y0 + 0.8, 29), P(x0 + 0.8, y0 + 0.8, 31), '#555', 0.5);
      railing(ctx, x0 + 0.25, y0 + 0.25, x1 - 1.05, y1 - 0.85, 21);
      acUnit(ctx, x1 - 1.7, y0 + 0.45, 21, t); acUnit(ctx, x1 - 1.7, y0 + 0.85, 21, t + 1);
      vent(ctx, x0 + 0.5, y1 - 1.45, 0.35, 21);
      // 停機坪
      const hp = [P(x1 - 0.9, y1 - 0.8, 2.4), P(x1 - 0.1, y1 - 0.8, 2.4), P(x1 - 0.1, y1 - 0.1, 2.4), P(x1 - 0.9, y1 - 0.1, 2.4)];
      poly(ctx, hp, '#45494d');
      const [hx, hy] = P(x1 - 0.5, y1 - 0.45, 2.4);
      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(hx, hy, 9, 4.5, 0, 0, 6.283); ctx.stroke();
      ctx.save(); ctx.translate(hx, hy); ctx.transform(1, 0.5, -1, 0.5, 0, 0);
      ctx.fillStyle = '#f0f0f0'; ctx.fillRect(-2.6, -2.6, 1, 5.2); ctx.fillRect(1.6, -2.6, 1, 5.2); ctx.fillRect(-2.6, -0.5, 5.2, 1);
      ctx.restore();
      for (let k = 0; k < 4; k++) blink(ctx, x1 - 0.9 + (k % 2) * 0.8, y1 - 0.8 + (k >> 1) * 0.7, 2.6, '#40ff60', k, 4);
      // 起重機(桁架)
      const mx = x1 - 0.45, my = y0 + 0.35, top = 44;
      const a = P(mx - 0.06, my, 2.4), b2 = P(mx + 0.06, my, 2.4), at = P(mx - 0.06, my, top), bt = P(mx + 0.06, my, top);
      line(ctx, a, at, '#d8a820', 0.6); line(ctx, b2, bt, '#b88a10', 0.6);
      ctx.strokeStyle = '#e0b030'; ctx.lineWidth = 0.25; ctx.beginPath();
      for (let k = 0; k < 14; k++) { const za = 2.4 + k * (top - 2.4) / 14, zb = za + (top - 2.4) / 14; const p1 = P(mx - 0.06, my, za), p2 = P(mx + 0.06, my, zb); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); }
      ctx.stroke();
      const ang = Math.sin(t * 0.25) * 0.9 + 2.4;
      const jx = mx + Math.cos(ang) * 2.0, jy = my + Math.sin(ang) * 2.0;
      const cx2 = mx - Math.cos(ang) * 0.6, cy2 = my - Math.sin(ang) * 0.6;
      const pj = P(jx, jy, top), pm = P(mx, my, top), pc = P(cx2, cy2, top);
      line(ctx, pc, pj, '#e8c040', 1); line(ctx, [pc[0], pc[1] + 1], [pj[0], pj[1] + 1], '#a07810', 0.4);
      for (let k = 1; k < 10; k++) { const f = k / 10; line(ctx, [pm[0] + (pj[0] - pm[0]) * f, pm[1] + (pj[1] - pm[1]) * f], [pm[0] + (pj[0] - pm[0]) * (f + 0.05), pm[1] + (pj[1] - pm[1]) * (f + 0.05) + 1], '#c09018', 0.25); }
      const cw = P(cx2, cy2, top); pix(ctx, cw[0] - 1.5, cw[1] - 0.5, 3, 2.5, '#555');
      const hookF = 0.7, hxw = mx + (jx - mx) * hookF, hyw = my + (jy - my) * hookF, hz = 18 + Math.sin(t * 0.4) * 8;
      const ph = P(hxw, hyw, top), phz = P(hxw, hyw, hz);
      line(ctx, ph, phz, '#333', 0.25); pix(ctx, phz[0] - 1.6, phz[1], 3.2, 2, '#c08020');
      blink(ctx, mx, my, top + 1, '#ff3030', 0, 3);
      break;
    }
    case 'power': {
      slab(ctx, b, 2, '#767c83');
      isoBox(ctx, x0 + 0.18, y0 + 0.18, x1 - 0.18, y1 - 0.18, 2, 7.5, conc, '#a0a6ad');
      const sw = FSW(x0 + 0.18, x1 - 0.18, y1 - 0.18), se = FSE(x1 - 0.18, y0 + 0.18, y1 - 0.18);
      band(ctx, sw, 5.2, 6.6, col); band(ctx, se, 5.2, 6.6, shade(col, 0.75));
      for (const F of [sw, se]) for (let k = 0; k < 4; k++) { const q = faceQuad(F, 0.1 + k * 0.22, 0.24 + k * 0.22, 2.8, 4.6); poly(ctx, q, '#3d4247'); for (let j = 1; j < 4; j++) line(ctx, F(0.1 + k * 0.22, 2.8 + j * 0.45), F(0.24 + k * 0.22, 2.8 + j * 0.45), '#6a7076', 0.25); }
      // 冷卻管與儲槽
      for (const [cx, cy] of [[x0 + 0.38, y0 + 0.38], [x1 - 0.38, y0 + 0.38], [x0 + 0.38, y1 - 0.38]]) {
        pipe(ctx, [cx, cy, 9], [b.x, b.y, 10], 1, '#9aa0a6');
        isoCyl(ctx, cx, cy, 0.14, 7.5, 13, '#b5bbc1', '#d0d5da', 3);
      }
      // 環形反應爐
      isoCyl(ctx, b.x, b.y, 0.6, 7.5, 12.5, '#aeb4bb', '#c4c9cf', 3);
      const glowA = powered ? 0.55 + 0.35 * Math.sin(t * 3) : 0.15;
      const [gx, gy] = P(b.x, b.y, 12.5);
      const rx = 0.48 * HW * 1.414;
      // 玻璃圓頂
      const dg = ctx.createRadialGradient(gx - 2, gy - 5, 0, gx, gy - 2, rx * 1.1);
      dg.addColorStop(0, `rgba(230,255,255,${0.6 + glowA * 0.4})`); dg.addColorStop(0.4, `rgba(80,220,255,${0.5 + glowA * 0.4})`); dg.addColorStop(1, 'rgba(20,80,120,0.85)');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(gx, gy, rx, rx * 0.5, 0, 0, Math.PI); ctx.ellipse(gx, gy, rx, 8, 0, 0, Math.PI, true); ctx.fill();
      glow(ctx, gx, gy - 3, 12, '#60e8ff', glowA * 0.7);
      circ(ctx, gx, gy - 3, 2 + glowA * 1.5, `rgba(255,255,255,${0.5 + glowA * 0.5})`);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.ellipse(gx, gy, rx * 0.8, 6.5, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI; line(ctx, [gx + Math.cos(Math.PI + a) * rx, gy + Math.sin(Math.PI + a) * 0], [gx + Math.cos(Math.PI + a) * rx * 0.2, gy - 7.5], 'rgba(40,70,90,0.35)', 0.25); }
      // 變壓器
      isoBox(ctx, x1 - 0.55, y1 - 0.55, x1 - 0.2, y1 - 0.2, 7.5, 10.5, '#6c7278', '#848a90');
      for (let k = 0; k < 3; k++) { const [ix, iy] = P(x1 - 0.5 + k * 0.12, y1 - 0.38, 10.5); line(ctx, [ix, iy], [ix, iy - 2], '#bbb', 0.5); circ(ctx, ix, iy - 2, 0.4, '#8a5'); }
      if (powered && Math.random() < 0.06) G.effects.push({ k: 'smoke', x: x0 + 0.38, y: y0 + 0.38, z: 13, t: 0, dur: 1.6, light: true });
      blink(ctx, x1 - 0.38, y0 + 0.38, 13.5, '#ff3030', 1);
      break;
    }
    case 'refinery': {
      slab(ctx, b, 2, '#767c83');
      // 卸載平台
      poly(ctx, [P(x1 - 0.95, y0 + 0.95, 2), P(x1 - 0.05, y0 + 0.95, 2), P(x1 - 0.05, y0 + 2.05, 2), P(x1 - 0.95, y0 + 2.05, 2)], '#4d5156');
      hazard(ctx, FSE(x1 - 0.05, y0 + 0.95, y0 + 2.05), 0.3, 1.8, 8);
      // 主處理廠(浪板外牆)
      isoBox(ctx, x0 + 0.2, y0 + 0.2, x1 - 1.15, y1 - 0.25, 2, 16, '#8b9198', '#7a8188');
      const sw = FSW(x0 + 0.2, x1 - 1.15, y1 - 0.25), se = FSE(x1 - 1.15, y0 + 0.2, y1 - 0.25);
      seams(ctx, sw, 22, 2, 16, 'rgba(0,0,0,0.16)'); seams(ctx, se, 26, 2, 16, 'rgba(0,0,0,0.16)');
      band(ctx, sw, 12.5, 14.3, col); band(ctx, se, 12.5, 14.3, shade(col, 0.75));
      windows(ctx, sw, 3, 1, 8, 11, seed, { lit: 0.4 });
      band(ctx, se, 2, 8.5, '#33383c', 0.55, 0.85);
      for (let k = 0; k < 5; k++) line(ctx, se(0.55, 3 + k * 1.2), se(0.85, 3 + k * 1.2), '#4d5257', 0.3);
      // 屋頂天窗
      for (let k = 0; k < 3; k++) {
        const yy = y0 + 0.5 + k * 0.75;
        poly(ctx, [P(x0 + 0.4, yy, 16), P(x1 - 1.35, yy, 16), P(x1 - 1.35, yy + 0.25, 16), P(x0 + 0.4, yy + 0.25, 16)], 'rgba(120,170,210,0.7)');
      }
      // 煙囪
      isoCyl(ctx, x0 + 0.55, y0 + 0.55, 0.13, 16, 32, '#c8ccd0', '#555', 0);
      for (let k = 0; k < 3; k++) { const [rx2, ry2] = P(x0 + 0.55, y0 + 0.55, 24 + k * 3); pix(ctx, rx2 - 2.6, ry2, 5.2, 1.2, '#c03020'); }
      if (Math.random() < 0.12) G.effects.push({ k: 'smoke', x: x0 + 0.55, y: y0 + 0.55, z: 32, t: 0, dur: 1.8 });
      // 儲槽
      for (const yy of [y0 + 0.62, y0 + 1.55]) {
        isoCyl(ctx, x1 - 0.55, yy, 0.36, 2, 24, '#b9bec4', '#cfd4d9', 6);
        const [cx2, cy2] = P(x1 - 0.55, yy, 24);
        poly(ctx, [[cx2 - 10, cy2], [cx2, cy2 - 4], [cx2 + 10, cy2]], '#9aa0a6');
        const [bx2, by2] = P(x1 - 0.55, yy, 18);
        pix(ctx, bx2 - 10, by2, 20, 1.6, col);
        // 爬梯
        const l0 = P(x1 - 0.55 + 0.25, yy + 0.25, 2), l1 = P(x1 - 0.55 + 0.25, yy + 0.25, 24);
        line(ctx, l0, l1, '#555', 0.25); line(ctx, [l0[0] + 1.2, l0[1]], [l1[0] + 1.2, l1[1]], '#555', 0.25);
        for (let k = 0; k < 14; k++) { const yk = l0[1] + (l1[1] - l0[1]) * k / 14; line(ctx, [l0[0], yk], [l0[0] + 1.2, yk], '#555', 0.2); }
      }
      // 輸送帶
      const ca = P(x1 - 0.15, y0 + 1.5, 4), cb = P(x1 - 1.15, y0 + 1.5, 11);
      line(ctx, ca, cb, '#3a3d40', 2.2); line(ctx, [ca[0], ca[1] - 0.9], [cb[0], cb[1] - 0.9], '#6a6e72', 0.4);
      for (let k = 0; k < 8; k++) { const f = ((k / 8) + t * 0.4) % 1; circ(ctx, ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f - 0.4, 0.5, '#e0a83a'); }
      pipe(ctx, [x1 - 0.55, y0 + 0.62, 20], [x1 - 1.15, y0 + 0.62, 14], 0.9, '#9aa0a6');
      blink(ctx, x1 - 0.05, y0 + 0.95, 3, '#ffa020', 0, 5); blink(ctx, x1 - 0.05, y0 + 2.05, 3, '#ffa020', 3, 5);
      break;
    }
    case 'barracks': {
      slab(ctx, b, 1.6, '#787d72');
      const olive = '#6f7a5a';
      isoBox(ctx, x0 + 0.2, y0 + 0.25, x1 - 0.22, y1 - 0.2, 1.6, 12, olive, '#5f694c');
      const sw = FSW(x0 + 0.2, x1 - 0.22, y1 - 0.2), se = FSE(x1 - 0.22, y0 + 0.25, y1 - 0.2);
      seams(ctx, sw, 8, 1.6, 12); seams(ctx, se, 8, 1.6, 12);
      windows(ctx, sw, 4, 2, 4, 11, seed, { lit: 0.35 });
      windows(ctx, se, 4, 2, 4, 11, seed + 5, { lit: 0.35 });
      band(ctx, sw, 1.6, 7.5, '#2b2f25', 0.4, 0.62);
      // 雨棚與燈箱
      poly(ctx, [sw(0.34, 8), sw(0.68, 8), P(x0 + 0.2 + (x1 - x0 - 0.42) * 0.68, y1 + 0.05, 7.2), P(x0 + 0.2 + (x1 - x0 - 0.42) * 0.34, y1 + 0.05, 7.2)], shade(col, 0.85));
      band(ctx, sw, 9, 10.6, col, 0.38, 0.64);
      // 屋頂:護牆、通訊天線
      isoBox(ctx, x0 + 0.2, y0 + 0.25, x1 - 0.22, y0 + 0.35, 12, 13, shade(olive, 0.9));
      isoBox(ctx, x0 + 0.2, y0 + 0.25, x0 + 0.3, y1 - 0.2, 12, 13, shade(olive, 0.9));
      acUnit(ctx, x1 - 0.75, y0 + 0.5, 12, t);
      dish(ctx, x0 + 0.65, y1 - 0.6, 14.5, 2, 0.8);
      // 沙包
      for (let k = 0; k < 7; k++) {
        const [sx2, sy2] = P(x0 + 0.15 + k * 0.12, y1 + 0.06, 0);
        ell(ctx, sx2, sy2 - 1, 1.6, 1, '#a89a70'); ell(ctx, sx2 - 0.3, sy2 - 1.3, 1, 0.5, '#c4b68a');
        if (k % 2) { ell(ctx, sx2 + 0.6, sy2 - 2.4, 1.5, 0.9, '#9e9068'); }
      }
      flag(ctx, x0 + 0.32, y0 + 0.4, 13, 17, col, t);
      break;
    }
    case 'factory': {
      slab(ctx, b, 2, '#767c83');
      isoBox(ctx, x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, 2, 19, '#899097', '#7d848b');
      const sw = FSW(x0 + 0.15, x1 - 0.15, y1 - 0.15), se = FSE(x1 - 0.15, y0 + 0.15, y1 - 0.15);
      seams(ctx, sw, 12, 2, 19); seams(ctx, se, 12, 2, 19);
      band(ctx, sw, 15.5, 17.5, col); band(ctx, se, 15.5, 17.5, shade(col, 0.75));
      // 大型車庫門
      band(ctx, sw, 2, 13.5, '#e8c020', 0.2, 0.8);
      hazard(ctx, sw, 12.3, 13.5, 12, 0.2, 0.8);
      band(ctx, sw, 2, 12.3, '#3a3f44', 0.23, 0.77);
      for (let k = 0; k < 9; k++) line(ctx, sw(0.23, 2.8 + k * 1.1), sw(0.77, 2.8 + k * 1.1), '#565c62', 0.3);
      blink(ctx, x0 + 0.15 + (x1 - x0 - 0.3) * 0.17, y1 - 0.15, 11, '#ffa020', 0, 5);
      blink(ctx, x0 + 0.15 + (x1 - x0 - 0.3) * 0.83, y1 - 0.15, 11, '#ffa020', Math.PI, 5);
      // 側面辦公室窗戶
      windows(ctx, se, 7, 2, 6, 14, seed, { lit: 0.3 });
      // 鋸齒屋頂與天窗
      for (let k = 0; k < 4; k++) {
        const yy = y0 + 0.35 + k * 0.62;
        const a1 = P(x0 + 0.3, yy, 19), a2 = P(x1 - 0.3, yy, 19), a3 = P(x1 - 0.3, yy + 0.3, 22), a4 = P(x0 + 0.3, yy + 0.3, 22);
        poly(ctx, [a1, a2, a3, a4], 'rgba(130,180,215,0.75)');
        const b3 = P(x1 - 0.3, yy + 0.55, 19), b4 = P(x0 + 0.3, yy + 0.55, 19);
        poly(ctx, [a4, a3, b3, b4], '#6d747b');
        line(ctx, a4, a3, 'rgba(255,255,255,0.5)', 0.3);
      }
      // 排氣管
      for (const yy of [y0 + 0.4, y1 - 0.5]) {
        isoCyl(ctx, x1 - 0.45, yy, 0.1, 19, 27, '#6a7076', '#222');
        if (Math.random() < 0.05) G.effects.push({ k: 'smoke', x: x1 - 0.45, y: yy, z: 27, t: 0, dur: 1.5 });
      }
      railing(ctx, x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, 19);
      break;
    }
    case 'tech': {
      slab(ctx, b, 2, '#9aa0a6');
      isoBox(ctx, x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, 2, 17, '#d8dde2', '#e4e8ec');
      const sw = FSW(x0 + 0.2, x1 - 0.2, y1 - 0.2), se = FSE(x1 - 0.2, y0 + 0.2, y1 - 0.2);
      // 玻璃帷幕
      windows(ctx, sw, 6, 4, 3.5, 15, seed, { mu: 0.06, mz: 0.08, lit: 0.12, glassB: '#1a3550', glassT: '#6fb0e0' });
      windows(ctx, se, 6, 4, 3.5, 15, seed + 1, { mu: 0.06, mz: 0.08, lit: 0.12, glassB: '#14304a', glassT: '#5a9ccc' });
      band(ctx, sw, 2, 3.4, col); band(ctx, se, 2, 3.4, shade(col, 0.75));
      band(ctx, sw, 15.3, 16.2, '#b0b8c0'); band(ctx, se, 15.3, 16.2, '#a0a8b0');
      // 太陽能板
      for (let k = 0; k < 2; k++) {
        const xx = x0 + 0.35 + k * 0.42;
        const q = [P(xx, y0 + 0.35, 18.5), P(xx + 0.35, y0 + 0.35, 18.5), P(xx + 0.35, y0 + 0.75, 17.2), P(xx, y0 + 0.75, 17.2)];
        poly(ctx, q, vgrad(ctx, q[2][1], q[0][1], '#1a2a50', '#3a5a9a'));
        for (let j = 1; j < 4; j++) line(ctx, P(xx + j * 0.0875, y0 + 0.35, 18.5), P(xx + j * 0.0875, y0 + 0.75, 17.2), 'rgba(160,190,255,0.4)', 0.2);
        line(ctx, P(xx, y0 + 0.55, 17.85), P(xx + 0.35, y0 + 0.55, 17.85), 'rgba(160,190,255,0.4)', 0.2);
      }
      // 大型雷達
      line(ctx, P(x1 - 0.6, y1 - 0.6, 17), P(x1 - 0.6, y1 - 0.6, 24), '#888', 0.8);
      dish(ctx, x1 - 0.6, y1 - 0.6, 26, 5, t * 0.9);
      // 天線陣列
      for (let k = 0; k < 3; k++) {
        const ax = x0 + 0.4 + k * 0.15, ay = y1 - 0.45;
        line(ctx, P(ax, ay, 17), P(ax, ay, 26 + k * 3), '#9aa', 0.35);
        blink(ctx, ax, ay, 26.5 + k * 3, k === 1 ? '#40ff80' : '#ff4040', k * 1.3, 4);
      }
      break;
    }
    case 'ac_turret': case 'ep_turret': {
      const isAC = b.type === 'ac_turret';
      // 八角裝甲基座
      pushA(ctx, 0.3); poly(ctx, [P(x0 - 0.1, y0 - 0.1), P(x1 + 0.12, y0 - 0.1), P(x1 + 0.12, y1 + 0.12), P(x0 - 0.1, y1 + 0.12)], '#000'); popA(ctx);
      const Q = lframe(b.x, b.y, 0);
      const oct = [];
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + 0.39; oct.push([Math.cos(a) * 0.46, Math.sin(a) * 0.46]); }
      const octT = oct.map(([a, c]) => [a * 0.82, c * 0.82]);
      prism(ctx, Q, oct, octT, 0, 7, isAC ? '#7a828c' : '#7d7a70', isAC ? '#8e96a0' : '#918e84', { outline: true });
      for (let k = 0; k < 8; k++) { const [a, c] = oct[k]; line(ctx, Q(a, c, 0), Q(a * 0.82, c * 0.82, 7), 'rgba(0,0,0,0.2)', 0.3); }
      const ring = octT.map(([a, c]) => Q(a, c, 7));
      polyStroke(ctx, ring, col, 0.9);
      const T = lframe(b.x, b.y, b.tdir);
      const charge = b.weapon ? clamp(1 - b.cool / b.weapon.rof, 0, 1) : 0;
      if (isAC) {
        isoCyl(ctx, b.x, b.y, 0.24, 7, 10, '#8f98a2', '#a8b0b9');
        const [dx2, dy2] = P(b.x, b.y, 10);
        ctx.fillStyle = vgrad(ctx, dy2, dy2 - 5, '#6a737c', '#c8d0d8');
        ctx.beginPath(); ctx.ellipse(dx2, dy2, 6.8, 5, 0, Math.PI, 0); ctx.fill();
        prism(ctx, T, rect(0, -0.07, 0.25, 0.07), rect(0, -0.06, 0.23, 0.06), 10.5, 13, '#5a626b', '#7a838c');
        barrel(ctx, T, 0.2, 0.62, 0, 11.8, 0.05, '#7a828c');
        for (let k = 0; k < 3; k++) { const [cx, cy] = T(0.3 + k * 0.09, 0, 11.8); ell(ctx, cx, cy, 1.2, 1.4, '#2a2e34'); if (powered) { pushA(ctx, 0.5 + 0.5 * charge); ell(ctx, cx, cy, 0.8, 1, FACTIONS.ac.beam); popA(ctx); } }
        const [ex, ey] = T(0.62, 0, 11.8);
        if (powered) glow(ctx, ex, ey, 3 + 3 * charge, FACTIONS.ac.beam, 0.8);
        circ(ctx, ex, ey, 0.8, powered ? '#ffe0e4' : '#552030');
        const [sx2, sy2] = T(-0.1, 0.12, 12); circ(ctx, sx2, sy2, 0.8, '#203040'); circ(ctx, sx2 - 0.2, sy2 - 0.2, 0.3, '#8fd8ff');
      } else {
        const hb = [[0.2, -0.13], [0.2, 0.13], [0.0, 0.22], [-0.24, 0.18], [-0.24, -0.18], [0.0, -0.22]];
        const ht = hb.map(([a, c]) => [a * 0.85, c * 0.85]);
        isoCyl(ctx, b.x, b.y, 0.26, 7, 8.5, '#5f6066');
        prism(ctx, T, hb, ht, 8.5, 13.5, '#6c7076', '#868a90', { outline: true });
        for (let k = 0; k < 3; k++) { const lit = powered && (G.time * 2 + k) % 3 < 2; prism(ctx, T, rect(-0.22, -0.12 + k * 0.085, -0.12, -0.06 + k * 0.085), rect(-0.22, -0.12 + k * 0.085, -0.12, -0.06 + k * 0.085), 13.5, 14.6, '#3a3e44', lit ? '#7fd8ff' : '#3a5060'); }
        for (const sd of [-1, 1]) prism(ctx, T, rect(0.05, sd * 0.07 - 0.02, 0.78, sd * 0.07 + 0.02), rect(0.05, sd * 0.07 - 0.016, 0.78, sd * 0.07 + 0.016), 10.5, 11.8, '#7e8790', '#aab3bc');
        for (let k = 0; k < 7; k++) {
          const [cx, cy] = T(0.12 + k * 0.1, 0, 11.2);
          const a = powered ? (0.3 + 0.7 * charge) * (0.5 + 0.5 * Math.sin(G.time * 10 - k)) : 0;
          if (a > 0.05) glow(ctx, cx, cy, 1.8, '#9fe3ff', a);
        }
        const [sx2, sy2] = T(0.05, -0.16, 13); circ(ctx, sx2, sy2, 0.7, '#1a1c1e'); circ(ctx, sx2, sy2, 0.35, powered ? '#ff4030' : '#422');
      }
      break;
    }
    case 'ac_super': {
      slab(ctx, b, 2, '#5a6068');
      isoBox(ctx, x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, 2, 8, '#4a5058', '#5c636c');
      const sw = FSW(x0 + 0.15, x1 - 0.15, y1 - 0.15), se = FSE(x1 - 0.15, y0 + 0.15, y1 - 0.15);
      band(ctx, sw, 5, 6.5, col); band(ctx, se, 5, 6.5, shade(col, 0.75));
      windows(ctx, sw, 5, 1, 2.5, 4.6, seed, { lit: 0.5 });
      const ready = b.charge >= b.def.charge, f = clamp(b.charge / b.def.charge, 0, 1);
      // 相位陣列天線(傾斜面板)
      const tilt = 6 + Math.sin(t * 0.5);
      const pa = [P(x0 + 0.35, y0 + 0.35, 9 + tilt * 2), P(x1 - 0.35, y0 + 0.35, 9 + tilt * 2), P(x1 - 0.3, y1 - 0.3, 10), P(x0 + 0.3, y1 - 0.3, 10)];
      poly(ctx, pa, vgrad(ctx, pa[2][1], pa[0][1], '#1a2a48', '#3a5a8a'));
      for (let k = 1; k < 8; k++) { const u = k / 8; line(ctx, [pa[0][0] + (pa[1][0] - pa[0][0]) * u, pa[0][1] + (pa[1][1] - pa[0][1]) * u], [pa[3][0] + (pa[2][0] - pa[3][0]) * u, pa[3][1] + (pa[2][1] - pa[3][1]) * u], 'rgba(140,180,240,0.5)', 0.25); }
      for (let k = 1; k < 6; k++) { const u = k / 6; line(ctx, [pa[0][0] + (pa[3][0] - pa[0][0]) * u, pa[0][1] + (pa[3][1] - pa[0][1]) * u], [pa[1][0] + (pa[2][0] - pa[1][0]) * u, pa[1][1] + (pa[2][1] - pa[1][1]) * u], 'rgba(140,180,240,0.5)', 0.25); }
      // 充能指示
      for (let k = 0; k < 10; k++) { const lit = k / 10 < f; const [lx, ly] = sw(0.1 + k * 0.08, 7.3); pix(ctx, lx - 0.6, ly - 0.4, 1.2, 0.8, lit ? (ready ? '#ff4060' : '#ffb030') : '#333'); }
      line(ctx, P(b.x, b.y, 10), P(b.x, b.y, 36), '#9aa', 0.8);
      for (let k = 0; k < 4; k++) { const [rx2, ry2] = P(b.x, b.y, 16 + k * 5); ell(ctx, rx2, ry2, 3 - k * 0.5, 1.2, 'rgba(160,170,180,0.9)'); }
      const [lx, ly] = P(b.x, b.y, 37);
      if (ready) glow(ctx, lx, ly, 10, '#ff3048', 0.5 + 0.4 * Math.sin(t * 8));
      circ(ctx, lx, ly, 1.6, ready ? '#ffd0d8' : shade('#ff3048', 0.35 + 0.65 * f));
      break;
    }
    case 'ep_super': {
      slab(ctx, b, 2, '#5a6068');
      isoBox(ctx, x0 + 0.12, y0 + 0.12, x1 - 0.12, y1 - 0.12, 2, 6, '#4f545a', '#5d636a');
      const sw = FSW(x0 + 0.12, x1 - 0.12, y1 - 0.12), se = FSE(x1 - 0.12, y0 + 0.12, y1 - 0.12);
      hazard(ctx, sw, 3, 4.6, 14); hazard(ctx, se, 3, 4.6, 14);
      const ready = b.charge >= b.def.charge, f = clamp(b.charge / b.def.charge, 0, 1);
      const open = ready ? 0.33 : f > 0.95 ? (f - 0.95) * 6.6 : 0;
      poly(ctx, [P(x0 + 0.38, y0 + 0.38, 6), P(x1 - 0.38, y0 + 0.38, 6), P(x1 - 0.38, y1 - 0.38, 6), P(x0 + 0.38, y1 - 0.38, 6)], '#0e0f10');
      if (ready || open > 0) {
        isoCyl(ctx, b.x, b.y, 0.15, 0, 26, '#e0e4e8', '#e8ecef', 6);
        const [nx, ny] = P(b.x, b.y, 26);
        poly(ctx, [[nx - 4.2, ny], [nx, ny - 9], [nx + 4.2, ny]], '#c03020');
        pix(ctx, nx - 4.2, ny + 6, 8.4, 2, col);
      }
      isoBox(ctx, x0 + 0.38 - open, y0 + 0.38, b.x - open, y1 - 0.38, 6, 8, '#6a7078', '#7d838b');
      isoBox(ctx, b.x + open, y0 + 0.38, x1 - 0.38 + open, y1 - 0.38, 6, 8, '#6a7078', '#7d838b');
      for (const xx of [x0 + 0.5 - open, b.x + 0.12 + open]) for (let k = 0; k < 3; k++) line(ctx, P(xx, y0 + 0.5 + k * 0.35, 8), P(xx + 0.3, y0 + 0.5 + k * 0.35, 8), '#4a4f55', 0.3);
      for (let k = 0; k < 4; k++) blink(ctx, k % 2 ? x1 - 0.2 : x0 + 0.2, k < 2 ? y0 + 0.2 : y1 - 0.2, 6.5, ready ? '#ff2020' : '#f0c020', k, ready ? 9 : 2);
      for (let k = 0; k < 10; k++) { const lit = k / 10 < f; const [lx, ly] = se(0.1 + k * 0.08, 5.4); pix(ctx, lx - 0.6, ly - 0.4, 1.2, 0.8, lit ? '#ff6030' : '#333'); }
      break;
    }
  }
  R.zs = 1;
  if (b.prog < 1 && !b.ghost) {
    // 施工鷹架
    const z = 22 * b.prog;
    pushA(ctx, 0.8);
    for (const [x, y] of [[x0, y1], [x1, y1], [x1, y0]]) line(ctx, P(x, y, 0), P(x, y, z + 6), '#d0a020', 0.4);
    for (let k = 0; k < 4; k++) { const zz = k * (z + 6) / 4; line(ctx, P(x0, y1, zz), P(x1, y1, zz), '#d0a020', 0.25); line(ctx, P(x1, y1, zz), P(x1, y0, zz), '#d0a020', 0.25); }
    popA(ctx);
    if (Math.random() < 0.3) G.effects.push({ k: 'spark', x: x0 + Math.random() * b.w, y: y0 + Math.random() * b.h, z: z, c: '#fff0a0', t: 0, dur: 0.2 });
  }
  if (!b.ghost && b.prog >= 1 && b.hp / b.maxHp < 0.5 && Math.random() < 0.15) {
    G.effects.push({ k: 'smoke', x: x0 + Math.random() * b.w, y: y0 + Math.random() * b.h, z: 12, t: 0, dur: 1.4 });
    if (Math.random() < 0.4) G.effects.push({ k: 'fire', x: x0 + Math.random() * b.w, y: y0 + Math.random() * b.h, z: 8, t: 0, dur: 0.6 });
  }
}

// ========== 地物(預先渲染成精靈)==========
function drawDoodad(ctx, d) {
  const [sx, sy] = P(d.x, d.y, 0);
  const key = d.t + '_' + d.v;
  const s = spriteCached(key, 48, 52, 24, 44, (c, ax, ay) => d.t === T_TREE ? paintTree(c, ax, ay, d.v) : paintRock(c, ax, ay, d.v));
  ctx.drawImage(s.cv, sx - s.ax, sy - s.ay, s.w, s.h);
}
function paintTree(c, ax, ay, v) {
  const rng = mulberry32(v * 9973 + 17);
  const pine = v % 3 === 0;
  // 陰影
  const g = c.createRadialGradient(ax + 5, ay + 1, 0, ax + 5, ay + 1, 12);
  g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(ax + 5, ay + 1, 12, 4.5, 0, 0, 6.283); c.fill();
  if (pine) {
    const h = 24 + rng() * 8;
    c.fillStyle = '#4a3020'; c.fillRect(ax - 0.7, ay - 5, 1.4, 5);
    const layers = 5;
    for (let k = 0; k < layers; k++) {
      const f = k / layers, w = (1 - f) * 8 + 2, yb = ay - 3 - f * h * 0.85, yt = yb - h * 0.32;
      c.fillStyle = k % 2 ? '#24502c' : '#2c5a32';
      c.beginPath(); c.moveTo(ax - w, yb); c.lineTo(ax, yt); c.lineTo(ax + w, yb); c.quadraticCurveTo(ax, yb + 1.5, ax - w, yb); c.fill();
      c.fillStyle = '#3e7444'; c.beginPath(); c.moveTo(ax - w * 0.9, yb - 0.3); c.lineTo(ax, yt); c.lineTo(ax - w * 0.1, yb + 0.6); c.fill();
      for (let j = 0; j < 6; j++) { c.fillStyle = 'rgba(120,180,110,0.5)'; c.fillRect(ax - w * 0.7 + rng() * w * 0.7, yb - rng() * (yb - yt) * 0.6, 0.6, 0.6); }
    }
    return;
  }
  const h = 13 + rng() * 6, ox = (rng() - 0.5) * 2;
  // 樹幹與枝
  c.fillStyle = vgrad(c, ay, ay - h, '#3a2618', '#5a3c26');
  c.beginPath(); c.moveTo(ax - 1.4, ay); c.lineTo(ax - 0.6 + ox, ay - h * 0.7); c.lineTo(ax + 0.7 + ox, ay - h * 0.7); c.lineTo(ax + 1.3, ay); c.fill();
  c.strokeStyle = '#4a3020'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(ax + ox * 0.5, ay - h * 0.5); c.lineTo(ax + 4 + ox, ay - h * 0.75); c.moveTo(ax + ox * 0.5, ay - h * 0.45); c.lineTo(ax - 4 + ox, ay - h * 0.7); c.stroke();
  // 樹冠:由暗到亮層層堆疊
  const blobs = [];
  for (let k = 0; k < 16; k++) {
    const a = rng() * 6.283, r = Math.sqrt(rng()) * 7;
    blobs.push([ax + ox + Math.cos(a) * r * 1.1, ay - h - 2 + Math.sin(a) * r * 0.8, 3 + rng() * 3]);
  }
  const tones = ['#264a1e', '#335e26', '#3f722e', '#4f8838', '#67a046'];
  for (let L2 = 0; L2 < tones.length; L2++) {
    c.fillStyle = tones[L2];
    for (const [bx, by, br] of blobs) {
      const off = L2 * 0.7;
      const rr = br * (1 - L2 * 0.17);
      if (rr <= 0.3) continue;
      c.beginPath(); c.arc(bx - off, by - off * 1.1, rr, 0, 6.283); c.fill();
    }
  }
  // 葉片高光
  for (let k = 0; k < 40; k++) {
    const a = rng() * 6.283, r = Math.sqrt(rng()) * 9;
    c.fillStyle = rng() < 0.5 ? 'rgba(160,210,110,0.7)' : 'rgba(20,40,15,0.5)';
    c.fillRect(ax + ox + Math.cos(a) * r - 2, ay - h - 4 + Math.sin(a) * r * 0.7, 0.8, 0.6);
  }
}
function paintRock(c, ax, ay, v) {
  const rng = mulberry32(v * 7919 + 3);
  const g = c.createRadialGradient(ax + 3, ay + 1, 0, ax + 3, ay + 1, 15);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(ax + 3, ay + 1, 15, 5.5, 0, 0, 6.283); c.fill();
  const n = 2 + ((v >> 2) % 3);
  const rocks = [];
  for (let k = 0; k < n; k++) rocks.push([ax + (rng() - 0.5) * 14, ay - 1 + (rng() - 0.5) * 4, 4 + rng() * 6]);
  rocks.sort((a, b) => a[1] - b[1]);
  for (const [rx, ry, s] of rocks) {
    const h = s * (1.1 + rng() * 0.6);
    const pk = [rx + (rng() - 0.5) * s * 0.6, ry - h];
    const L = [rx - s * 1.1, ry - s * 0.15], Rr = [rx + s * 1.1, ry - s * 0.1], F = [rx + (rng() - 0.5) * s * 0.4, ry + s * 0.45];
    const ml = [rx - s * 0.7, ry - h * 0.65], mr = [rx + s * 0.75, ry - h * 0.6];
    // 左面(受光)、右面(背光)、頂面
    poly(c, [L, ml, pk, F], '#8a857c');
    poly(c, [F, pk, mr, Rr], '#5c5850');
    poly(c, [ml, pk, mr, [pk[0], pk[1] + h * 0.2]], '#a39e94');
    c.strokeStyle = 'rgba(30,28,24,0.5)'; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(F[0], F[1]); c.lineTo(pk[0], pk[1]); c.stroke();
    c.beginPath(); c.moveTo(rx - s * 0.3, ry - h * 0.3); c.lineTo(rx - s * 0.1, ry - h * 0.5); c.lineTo(rx - s * 0.25, ry - h * 0.7); c.stroke();
    for (let j = 0; j < 8; j++) { c.fillStyle = rng() < 0.5 ? 'rgba(90,120,60,0.6)' : 'rgba(200,195,180,0.5)'; c.fillRect(rx + (rng() - 0.6) * s * 1.2, ry - rng() * h * 0.5, 0.7, 0.5); }
  }
}

// ========== 稀土礦晶簇 ==========
function drawOre(ctx, x0, y0, x1, y1) {
  const m = G.map, p = me();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    if (!m.oreType[i] || m.ore[i] < 15 || !p.explored[i]) continue;
    const [cx, cy] = P(x + 0.5, y + 0.5, 0);
    const v = m.variant[i], amt = m.ore[i] / 800;
    const gem = m.oreType[i] === 2;
    const silver = ERAS[G.era] && ERAS[G.era].silver;
    const c1 = silver ? (gem ? '#f4cc50' : '#dfe3e8') : gem ? '#6fd8ff' : '#f0b848';
    const c2 = silver ? (gem ? '#9a7418' : '#6e7680') : gem ? '#2a78b0' : '#9a6418';
    const c3 = silver ? '#ffffff' : gem ? '#d8f6ff' : '#ffe8a0';
    // 礦床地面
    pushA(ctx, 0.16 * Math.min(1, amt + 0.3));
    ell(ctx, cx, cy, HW * 0.6, HH * 0.6, silver ? '#3a3e44' : gem ? '#204a60' : '#6a4a1a');
    popA(ctx);
    const n = 2 + Math.floor(amt * 6);
    for (let k = 0; k < n; k++) {
      const a = hash(v * 7 + k * 53), b2 = hash(v * 13 + k * 29);
      const px = cx + (a - b2) * HW * 0.75, py = cy + (a + b2 - 1) * HH * 0.75;
      const h = (2.5 + hash(v + k * 3) * 4) * (0.6 + amt * 0.5), w = h * 0.32, tilt = (hash(v * 3 + k) - 0.5) * h * 0.4;
      const L = [px - w, py], F = [px, py + w * 0.45], Rr = [px + w, py], T = [px + tilt, py - h];
      poly(ctx, [L, F, T], c1);
      poly(ctx, [F, Rr, T], c2);
      line(ctx, F, T, c3, 0.25);
      if (gem) glow(ctx, T[0], T[1] + h * 0.3, 2.5, silver ? '#ffe080' : '#7fe0ff', 0.35 + 0.2 * Math.sin(G.time * 3 + k + v));
    }
  }
}
