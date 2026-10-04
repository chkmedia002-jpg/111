'use strict';
// ===== 明朝時代模型:中式/日式/韓式建築、古代兵種 =====
const MSTYLE = {
  mg: { wall: '#b4432f', wood: '#6a2216', roof: '#66706b', ridge: '#2c3230', base: '#9e968a', eave: '#c8a040', paper: '#efe2c2', cloth: '#c23a2a', armor: '#6a2a20' },
  jp: { wall: '#eeeadf', wood: '#2b2622', roof: '#5a5f66', ridge: '#24272b', base: '#8e877a', eave: '#2b2622', paper: '#f2ead6', cloth: '#2c3448', armor: '#2a2622' },
  kr: { wall: '#e8e1d0', wood: '#a3372a', roof: '#6f7478', ridge: '#33373a', base: '#a29c90', eave: '#2f8f7a', paper: '#f0e6cf', cloth: '#ece6d8', armor: '#33507a' }
};
function styleOf(owner) { return MSTYLE[G.players[owner].faction] || MSTYLE.mg; }

// ---------- 建築零件 ----------
// 廡殿頂/歇山頂(含起翹與瓦壟)
function hipRoof(ctx, x0, y0, x1, y1, z, h, S, ov = 0.2, curl = 3) {
  ov *= 0.6;
  const ex0 = x0 - ov, ey0 = y0 - ov, ex1 = x1 + ov, ey1 = y1 + ov;
  const xm = (ex0 + ex1) / 2, ym = (ey0 + ey1) / 2, dx = ex1 - ex0, dy = ey1 - ey0;
  const A = [ex0, ey0], B = [ex1, ey0], C = [ex1, ey1], D = [ex0, ey1];
  let R1, R2, faces;
  if (dx >= dy) {
    const d = dy / 2 * 0.85; R1 = [ex0 + d, ym]; R2 = [ex1 - d, ym];
    faces = [{ e: [A, B], r: [R1, R2], f: 1.0, back: true }, { e: [A, D], r: [R1], f: 0.85, back: true }, { e: [B, C], r: [R2], f: 0.62 }, { e: [D, C], r: [R1, R2], f: 0.8 }];
  } else {
    const d = dx / 2 * 0.85; R1 = [xm, ey0 + d]; R2 = [xm, ey1 - d];
    faces = [{ e: [A, D], r: [R1, R2], f: 1.0, back: true }, { e: [A, B], r: [R1], f: 0.85, back: true }, { e: [B, C], r: [R1, R2], f: 0.62 }, { e: [D, C], r: [R2], f: 0.8 }];
  }
  const zt = z + h;
  const E = q => P(q[0], q[1], z), Rr = q => P(q[0], q[1], zt);
  for (const fc of faces) {
    const pts = [E(fc.e[0]), E(fc.e[1])].concat(fc.r.length === 2 ? [Rr(fc.r[1]), Rr(fc.r[0])] : [Rr(fc.r[0])]);
    poly(ctx, pts, shade(S.roof, fc.f));
    if (!fc.back) {
      // 瓦壟
      const n = Math.max(6, Math.round(Math.hypot(fc.e[1][0] - fc.e[0][0], fc.e[1][1] - fc.e[0][1]) * 9));
      ctx.strokeStyle = shade(S.roof, fc.f * 0.72); ctx.lineWidth = 0.35;
      ctx.beginPath();
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const ea = [fc.e[0][0] + (fc.e[1][0] - fc.e[0][0]) * t, fc.e[0][1] + (fc.e[1][1] - fc.e[0][1]) * t];
        const ra = fc.r.length === 2 ? [fc.r[0][0] + (fc.r[1][0] - fc.r[0][0]) * t, fc.r[0][1] + (fc.r[1][1] - fc.r[0][1]) * t] : fc.r[0];
        const a = E(ea), b = Rr(ra);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      // 簷口(彩繪)
      const a = E(fc.e[0]), b = E(fc.e[1]);
      poly(ctx, [a, b, [b[0], b[1] + 1.3], [a[0], a[1] + 1.3]], S.eave);
      line(ctx, [a[0], a[1] + 1.3], [b[0], b[1] + 1.3], shade(S.wood, 0.7), 0.3);
    }
  }
  // 正脊與鴟吻
  const r1 = Rr(R1), r2 = Rr(R2);
  ctx.lineCap = 'round'; line(ctx, r1, r2, S.ridge, 1.3); line(ctx, [r1[0], r1[1] - 0.5], [r2[0], r2[1] - 0.5], shade(S.ridge, 1.6), 0.3); ctx.lineCap = 'butt';
  for (const r of [r1, r2]) { ctx.strokeStyle = S.ridge; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(r[0], r[1]); ctx.quadraticCurveTo(r[0], r[1] - 2.5, r[0] + (r === r1 ? -1.2 : 1.2), r[1] - 3); ctx.stroke(); }
  // 垂脊
  for (const [c, r] of [[C, R2], [D, R1], [B, R2]]) line(ctx, E(c), Rr(r), shade(S.ridge, 1.2), 0.6);
  // 翹角
  const cm = P(xm, ym, z);
  for (const c of [A, B, C, D]) {
    const p = E(c), dxs = p[0] - cm[0], dys = p[1] - cm[1], l = Math.hypot(dxs, dys) || 1;
    ctx.strokeStyle = S.ridge; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[0] + dxs / l * 1.5, p[1] + dys / l * 0.8, p[0] + dxs / l * 2.2, p[1] - curl); ctx.stroke();
  }
}
// 木構牆(柱、樑、格窗、門)
function mWalls(ctx, x0, y0, x1, y1, z0, z1, S, opt = {}) {
  isoBox(ctx, x0, y0, x1, y1, z0, z1, S.wall, S.wall, { flat: true });
  const sw = FSW(x0, x1, y1), se = FSE(x1, y0, y1);
  const n = opt.cols || Math.max(2, Math.round((x1 - x0) * 3)), m = opt.rows || Math.max(2, Math.round((y1 - y0) * 3));
  if (opt.lowerPanel) { band(ctx, sw, z0, z0 + (z1 - z0) * 0.4, S.wood); band(ctx, se, z0, z0 + (z1 - z0) * 0.4, shade(S.wood, 0.8)); }
  for (const [F, k, fshade] of [[sw, n, 1], [se, m, 0.8]]) {
    for (let i = 0; i < k; i++) {
      const u0 = (i + 0.18) / k, u1 = (i + 0.82) / k, za = z0 + (z1 - z0) * (opt.lowerPanel ? 0.48 : 0.3), zb = z0 + (z1 - z0) * 0.82;
      if (opt.door && F === sw && i === Math.floor(k / 2)) {
        const q = faceQuad(F, u0, u1, z0, z0 + (z1 - z0) * 0.85);
        poly(ctx, q, shade(S.wood, 0.9 * fshade));
        for (let r = 1; r < 4; r++) for (let c = 1; c < 3; c++) { const p = F(u0 + (u1 - u0) * c / 3, z0 + (z1 - z0) * 0.85 * r / 4); circ(ctx, p[0], p[1], 0.25, '#d8b040'); }
        continue;
      }
      if (opt.noWin) continue;
      const q = faceQuad(F, u0, u1, za, zb);
      poly(ctx, q, shade(S.paper, fshade));
      ctx.strokeStyle = shade(S.wood, 0.8); ctx.lineWidth = 0.22; ctx.beginPath();
      for (let j = 1; j < 4; j++) { const a = F(u0 + (u1 - u0) * j / 4, za), b = F(u0 + (u1 - u0) * j / 4, zb); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let j = 1; j < 3; j++) { const a = F(u0, za + (zb - za) * j / 3), b = F(u1, za + (zb - za) * j / 3); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
    }
    for (let i = 0; i <= k; i++) line(ctx, F(i / k, z0), F(i / k, z1), shade(S.wood, fshade), 1);
    line(ctx, F(0, z1 - 0.5), F(1, z1 - 0.5), shade(S.wood, fshade), 0.9);
    line(ctx, F(0, z0 + 0.3), F(1, z0 + 0.3), shade(S.wood, fshade * 0.8), 0.6);
  }
}
// 石砌台基
function stoneBase(ctx, x0, y0, x1, y1, z0, z1, col, taper = 0) {
  if (taper) {
    const Q = lframe((x0 + x1) / 2, (y0 + y1) / 2, 0), hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
    prism(ctx, Q, rect(-hw, -hh, hw, hh), rect(-hw + taper, -hh + taper, hw - taper, hh - taper), z0, z1, col, shade(col, 1.08));
    x0 += taper; y0 += taper; x1 -= taper; y1 -= taper;
  } else isoBox(ctx, x0, y0, x1, y1, z0, z1, col, shade(col, 1.08));
  const sw = FSW(x0, x1, y1), se = FSE(x1, y0, y1);
  const rows = Math.max(2, Math.round((z1 - z0) / 1.6));
  for (const F of [sw, se]) for (let r = 1; r < rows; r++) {
    const z = z0 + (z1 - z0) * r / rows;
    line(ctx, F(0, z), F(1, z), 'rgba(0,0,0,0.2)', 0.25);
    for (let c = 0; c < 8; c++) { const u = (c + (r % 2) * 0.5) / 8; line(ctx, F(u, z), F(u, z + (z1 - z0) / rows), 'rgba(0,0,0,0.14)', 0.22); }
  }
}
function banner(ctx, x, y, z0, h, col, t, vertical) {
  line(ctx, P(x, y, z0), P(x, y, z0 + h), '#5a3c22', 0.5);
  const [fx, fy] = P(x, y, z0 + h);
  ctx.fillStyle = col;
  if (vertical) {
    // 直式旗(幟)
    ctx.beginPath(); ctx.moveTo(fx, fy);
    for (let k = 0; k <= 5; k++) ctx.lineTo(fx + 3.6 + Math.sin(t * 4 + k) * 0.4, fy + k * 1.8);
    ctx.lineTo(fx, fy + 9); ctx.closePath(); ctx.fill();
    pix(ctx, fx, fy, 3.8, 0.6, shade(col, 0.6));
  } else flag(ctx, x, y, z0, h, col, t);
}
function sacks(ctx, x, y, n, seed) {
  for (let k = 0; k < n; k++) {
    const [sx, sy] = P(x + (hash(seed + k) - 0.5) * 0.4, y + (hash(seed * 3 + k) - 0.5) * 0.3, (k > n / 2) ? 1.6 : 0);
    ell(ctx, sx + 0.3, sy + 0.2, 2.2, 1.1, 'rgba(0,0,0,0.3)');
    ell(ctx, sx, sy - 0.8, 2, 1.3, '#d6c79a'); ell(ctx, sx - 0.4, sy - 1.2, 1, 0.6, '#ece0b8');
    line(ctx, [sx - 0.6, sy - 1.9], [sx + 0.6, sy - 1.9], '#8a7a50', 0.3);
  }
}
function oreHeap(ctx, x, y, r, seed) {
  const [sx, sy] = P(x, y, 0);
  ell(ctx, sx, sy, r * 1.2, r * 0.6, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vgrad(ctx, sy, sy - r * 0.9, '#6a6e74', '#c8ccd2');
  ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.9, 0, Math.PI, 0); ctx.fill();
  for (let k = 0; k < 6; k++) circ(ctx, sx + (hash(seed + k) - 0.5) * r * 1.4, sy - hash(seed * 7 + k) * r * 0.7, 0.35, '#ffffff');
}
function brazier(ctx, x, y, z, t) {
  const [bx, by] = P(x, y, z);
  line(ctx, [bx, by], [bx, by - 4], '#3a2a1a', 0.6);
  ell(ctx, bx, by - 4, 1.6, 0.7, '#4a3a2a');
  glow(ctx, bx, by - 6, 5, '#ff8020', 0.7);
  const h = 2.5 + Math.sin(t * 9 + x) * 0.8;
  ctx.fillStyle = vgrad(ctx, by - 4, by - 4 - h, '#ffd040', 'rgba(255,60,10,0.2)');
  ctx.beginPath(); ctx.moveTo(bx - 1.3, by - 4); ctx.quadraticCurveTo(bx, by - 4 - h * 1.8, bx + 1.3, by - 4); ctx.fill();
}

// ---------- 建築 ----------
function drawBuildingMing(ctx, b, col, t, seed, powered) {
  const S = styleOf(b.owner), f = G.players[b.owner].faction;
  const x0 = b.tx, y0 = b.ty, x1 = b.tx + b.w, y1 = b.ty + b.h;
  const ground = () => { pushA(ctx, 0.3); poly(ctx, [P(x0 - 0.1, y0 - 0.1), P(x1 + 0.14, y0 - 0.1), P(x1 + 0.14, y1 + 0.14), P(x0 - 0.1, y1 + 0.14)], '#000'); popA(ctx); };
  switch (b.type) {
    case 'conyard': {
      ground();
      if (f === 'jp') {
        // 天守閣:斜石垣 + 三層
        stoneBase(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0, 11, S.base, 0.22);
        const tiers = [[0.5, 11, 7, 5], [0.8, 23, 5.5, 4.5], [1.05, 33, 4.5, 4]];
        for (const [ins, z, wh, rh] of tiers) {
          mWalls(ctx, x0 + ins, y0 + ins, x1 - ins, y1 - ins, z, z + wh, S, { lowerPanel: true, cols: 4, rows: 4 });
          hipRoof(ctx, x0 + ins, y0 + ins, x1 - ins, y1 - ins, z + wh, rh, S, 0.18, 2.5);
        }
        // 金鯱
        for (const s of [-1, 1]) { const [gx, gy] = P(b.x + s * 0.25, b.y, 41.8); poly(ctx, [[gx, gy], [gx - 0.8, gy - 2.6], [gx + 0.8, gy - 2.2]], '#e8b830'); }
        banner(ctx, x0 + 0.25, y1 - 0.25, 11, 9, col, t, true);
        banner(ctx, x1 - 0.25, y1 - 0.25, 11, 9, col, t + 1, true);
      } else if (f === 'mg') {
        // 城樓:磚台 + 拱門 + 重簷
        stoneBase(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0, 10, '#8c857a');
        const sw = FSW(x0 + 0.1, x1 - 0.1, y1 - 0.1);
        const [ax, ay] = sw(0.5, 0), [, ay2] = sw(0.5, 6);
        ctx.fillStyle = '#1e1a16'; ctx.beginPath(); ctx.moveTo(ax - 3.5, ay - 1.7); ctx.lineTo(ax - 3.5, ay2 + 1); ctx.quadraticCurveTo(ax, ay2 - 3.5, ax + 3.5, ay2 + 1); ctx.lineTo(ax + 3.5, ay + 1.7); ctx.fill();
        // 城垛
        for (let k = 0; k < 10; k++) { const u = (k + 0.25) / 10; poly(ctx, faceQuad(sw, u, u + 0.05, 10, 11.5), '#7a7468'); }
        mWalls(ctx, x0 + 0.45, y0 + 0.45, x1 - 0.45, y1 - 0.45, 10, 18, S, { door: true });
        hipRoof(ctx, x0 + 0.45, y0 + 0.45, x1 - 0.45, y1 - 0.45, 18, 5, S, 0.3, 3);
        mWalls(ctx, x0 + 0.85, y0 + 0.85, x1 - 0.85, y1 - 0.85, 21, 26, S, { cols: 3, rows: 3 });
        hipRoof(ctx, x0 + 0.85, y0 + 0.85, x1 - 0.85, y1 - 0.85, 26, 6, S, 0.28, 3.5);
        // 匾額
        const [px, py] = P(b.x, y1 - 0.85, 24);
        pix(ctx, px - 2.5, py - 1.2, 5, 2.4, '#1a2a4a'); pix(ctx, px - 2.2, py - 0.9, 4.4, 1.8, '#d8b040');
        for (const [xx, yy] of [[x0 + 0.2, y1 - 0.2], [x1 - 0.2, y1 - 0.2], [x1 - 0.2, y0 + 0.2]]) banner(ctx, xx, yy, 11.5, 9, col, t + xx, false);
      } else {
        // 朝鮮統制營:台基 + 大殿(單簷歇山)
        stoneBase(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0, 4, S.base);
        const sw = FSW(x0 + 0.1, x1 - 0.1, y1 - 0.1);
        for (let k = 0; k < 5; k++) poly(ctx, faceQuad(sw, 0.42, 0.58, k * 0.8, k * 0.8 + 0.8), shade(S.base, 0.9 + k * 0.03));
        mWalls(ctx, x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, 4, 14, S, { door: true, cols: 5, rows: 5 });
        hipRoof(ctx, x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, 14, 10, S, 0.38, 4);
        for (const [xx, yy] of [[x0 + 0.2, y1 - 0.2], [x1 - 0.2, y1 - 0.2]]) banner(ctx, xx, yy, 4, 12, col, t + xx, true);
      }
      break;
    }
    case 'power': {
      ground();
      // 高腳糧倉
      for (const [xx, yy] of [[x0 + 0.3, y0 + 0.3], [x1 - 0.35, y0 + 0.3], [x0 + 0.3, y1 - 0.35], [x1 - 0.35, y1 - 0.35]]) isoBox(ctx, xx, yy, xx + 0.08, yy + 0.08, 0, 3, '#5a3c22');
      isoBox(ctx, x0 + 0.22, y0 + 0.22, x1 - 0.22, y1 - 0.22, 3, 3.8, '#6a4a2c');
      const wall = f === 'jp' ? S.wall : '#8a6844';
      mWalls(ctx, x0 + 0.28, y0 + 0.28, x1 - 0.28, y1 - 0.28, 3.8, 10.5, Object.assign({}, S, { wall }), { door: true, cols: 3, rows: 3, noWin: f !== 'jp', lowerPanel: f === 'jp' });
      if (f !== 'jp') { const sw = FSW(x0 + 0.28, x1 - 0.28, y1 - 0.28); for (let k = 1; k < 10; k++) line(ctx, sw(0, 3.8 + k * 0.7), sw(1, 3.8 + k * 0.7), 'rgba(0,0,0,0.15)', 0.2); }
      hipRoof(ctx, x0 + 0.28, y0 + 0.28, x1 - 0.28, y1 - 0.28, 10.5, 7, S, 0.25, 2.5);
      sacks(ctx, x1 - 0.12, y1 - 0.5, 6, b.id);
      break;
    }
    case 'refinery': {
      ground();
      stoneBase(ctx, x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, 0, 1.5, '#8a8478');
      mWalls(ctx, x0 + 0.25, y0 + 0.25, x1 - 1.2, y1 - 0.3, 1.5, 9.5, S, { door: true, cols: 4, rows: 6 });
      hipRoof(ctx, x0 + 0.25, y0 + 0.25, x1 - 1.2, y1 - 0.3, 9.5, 6.5, S, 0.25, 2.5);
      // 冶煉爐
      isoCyl(ctx, x1 - 0.6, y0 + 0.65, 0.38, 1.5, 13, '#8a4a32', '#5a3020', 6);
      const [fx, fy] = P(x1 - 0.6, y0 + 0.65, 13);
      glow(ctx, fx, fy, 8, '#ff7020', 0.6 + 0.2 * Math.sin(t * 7));
      ell(ctx, fx, fy, 3.5, 1.7, '#ffb040');
      const [mx, my] = FSW(x1 - 0.98, x1 - 0.22, y0 + 1.03)(0.5, 3.5);
      ell(ctx, mx, my, 1.6, 1.4, '#1a0a05'); glow(ctx, mx, my, 3, '#ff9030', 0.8);
      if (Math.random() < 0.12) G.effects.push({ k: 'smoke', x: x1 - 0.6, y: y0 + 0.65, z: 14, t: 0, dur: 1.8 });
      oreHeap(ctx, x1 - 0.5, y0 + 1.6, 4, b.id); oreHeap(ctx, x1 - 0.3, y1 - 0.45, 3, b.id + 9);
      // 礦車軌道
      line(ctx, P(x1 - 0.95, y0 + 1.3, 1.5), P(x1 - 0.05, y0 + 1.3, 1.5), '#4a3a2a', 0.5);
      line(ctx, P(x1 - 0.95, y0 + 1.6, 1.5), P(x1 - 0.05, y0 + 1.6, 1.5), '#4a3a2a', 0.5);
      banner(ctx, x0 + 0.15, y1 - 0.15, 1.5, 10, col, t, true);
      break;
    }
    case 'barracks': {
      ground();
      stoneBase(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0, 1.4, '#8e887c');
      mWalls(ctx, x0 + 0.25, y0 + 0.2, x1 - 0.2, y1 - 0.5, 1.4, 8.5, S, { door: true, lowerPanel: f === 'jp', cols: 4, rows: 3 });
      hipRoof(ctx, x0 + 0.25, y0 + 0.2, x1 - 0.2, y1 - 0.5, 8.5, 6, S, 0.22, 2.5);
      // 兵器架
      const [ra, rb] = [P(x0 + 0.3, y1 - 0.18, 1.4), P(x0 + 1.1, y1 - 0.18, 1.4)];
      line(ctx, [ra[0], ra[1] - 3], [rb[0], rb[1] - 3], '#5a3c22', 0.6);
      for (let k = 0; k < 6; k++) {
        const x = ra[0] + (rb[0] - ra[0]) * (k + 0.5) / 6, y = ra[1] + (rb[1] - ra[1]) * (k + 0.5) / 6;
        line(ctx, [x, y], [x + 0.6, y - 9], '#6a4a2c', 0.35); poly(ctx, [[x + 0.6, y - 9], [x + 0.2, y - 7.6], [x + 1, y - 7.6]], '#c8ccd0');
      }
      // 草人靶
      const [dx, dy] = P(x1 - 0.3, y1 - 0.2, 1.4);
      line(ctx, [dx, dy], [dx, dy - 6], '#6a4a2c', 0.6); line(ctx, [dx - 2, dy - 4.5], [dx + 2, dy - 4.5], '#6a4a2c', 0.5);
      ell(ctx, dx, dy - 4, 1.3, 2.2, '#c8b070'); circ(ctx, dx, dy - 6.8, 1, '#c8b070');
      banner(ctx, x1 - 0.2, y0 + 0.2, 8, 10, col, t, f !== 'mg');
      break;
    }
    case 'factory': {
      ground();
      stoneBase(ctx, x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, 0, 1.5, '#8a8478');
      // 後牆
      mWalls(ctx, x0 + 0.2, y0 + 0.2, x1 - 0.2, y0 + 0.5, 1.5, 11, S, { noWin: true });
      mWalls(ctx, x0 + 0.2, y0 + 0.2, x0 + 0.5, y1 - 0.2, 1.5, 11, S, { noWin: true });
      // 鍛爐
      isoBox(ctx, x0 + 0.7, y0 + 0.7, x0 + 1.4, y0 + 1.3, 1.5, 5, '#7a4030', '#5a3020');
      const [fx, fy] = P(x0 + 1.05, y0 + 1.0, 5);
      glow(ctx, fx, fy, 7, '#ff6a10', 0.7 + 0.2 * Math.sin(t * 9)); ell(ctx, fx, fy, 2.5, 1.2, '#ffc040');
      isoBox(ctx, x0 + 0.9, y0 + 0.85, x0 + 1.2, y0 + 1.15, 5, 16, '#7a4030', '#3a2a20');
      if (Math.random() < 0.08) G.effects.push({ k: 'smoke', x: x0 + 1.05, y: y0 + 1.0, z: 17, t: 0, dur: 1.6 });
      if (Math.random() < 0.15) G.effects.push({ k: 'spark', x: x0 + 1.7, y: y0 + 1.6, z: 4, c: '#ffd060', t: 0, dur: 0.2 });
      // 鐵砧
      isoBox(ctx, x0 + 1.6, y0 + 1.5, x0 + 1.85, y0 + 1.7, 1.5, 3.5, '#3a3a3a', '#5a5a5a');
      // 木料堆
      for (let k = 0; k < 5; k++) { const [lx, ly] = P(x1 - 0.5, y0 + 0.5 + k * 0.12, 1.5 + (k % 2) * 1.4); ell(ctx, lx, ly, 1.2, 1.2, '#8a6440'); ell(ctx, lx, ly, 0.7, 0.7, '#c8a070'); }
      // 柱與屋頂(敞開式工坊)
      for (const [xx, yy] of [[x0 + 0.2, y1 - 0.2], [x1 - 0.2, y1 - 0.2], [x1 - 0.2, y0 + 0.2], [b.x, y1 - 0.2], [x1 - 0.2, b.y]]) line(ctx, P(xx, yy, 1.5), P(xx, yy, 11), S.wood, 1.1);
      hipRoof(ctx, x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, 11, 7, S, 0.25, 2.8);
      // 車輪
      const [wx, wy] = P(x1 - 0.1, y1 - 0.7, 3);
      ctx.strokeStyle = '#5a3c22'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(wx, wy, 1.6, 3, 0, 0, 6.283); ctx.stroke();
      for (let k = 0; k < 4; k++) { const a = k * 0.785; line(ctx, [wx, wy], [wx + Math.cos(a) * 1.5, wy + Math.sin(a) * 2.9], '#5a3c22', 0.3); }
      break;
    }
    case 'tech': {
      ground();
      stoneBase(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0, 2.5, S.base);
      mWalls(ctx, x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, 2.5, 9.5, S, { door: true, cols: 3, rows: 3, lowerPanel: f === 'jp' });
      hipRoof(ctx, x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, 9.5, 4, S, 0.3, 3);
      mWalls(ctx, x0 + 0.65, y0 + 0.65, x1 - 0.65, y1 - 0.65, 12, 16, S, { cols: 2, rows: 2 });
      hipRoof(ctx, x0 + 0.65, y0 + 0.65, x1 - 0.65, y1 - 0.65, 16, 5.5, S, 0.3, 3.5);
      // 寶頂
      const [px, py] = P(b.x, b.y, 21.5);
      line(ctx, [px, py], [px, py - 3], '#c8a040', 0.6); circ(ctx, px, py - 3.3, 0.8, '#e8c050');
      // 燈籠
      for (const s of [0.3, 0.7]) { const [lx, ly] = FSW(x0 + 0.35, x1 - 0.35, y1 - 0.35)(s, 8.6); line(ctx, [lx, ly - 1], [lx, ly], '#333', 0.2); ell(ctx, lx, ly + 1, 0.9, 1.3, '#e83a20'); glow(ctx, lx, ly + 1, 3, '#ff8040', 0.5); }
      break;
    }
    case 'mg_turret': {
      // 敵台:磚砌方台 + 佛郎機
      ground();
      stoneBase(ctx, x0 + 0.12, y0 + 0.12, x1 - 0.12, y1 - 0.12, 0, 12, '#8a8276');
      const sw = FSW(x0 + 0.12, x1 - 0.12, y1 - 0.12), se = FSE(x1 - 0.12, y0 + 0.12, y1 - 0.12);
      for (const F of [sw, se]) { for (let k = 0; k < 4; k++) poly(ctx, faceQuad(F, k / 4 + 0.04, k / 4 + 0.16, 12, 14), '#7a7468'); const [hx, hy] = F(0.5, 7); pix(ctx, hx - 0.6, hy - 1.2, 1.2, 2.4, '#1a1612'); }
      const T = lframe(b.x, b.y, b.tdir);
      prism(ctx, T, rect(-0.15, -0.1, 0.1, 0.1), rect(-0.15, -0.1, 0.1, 0.1), 12, 13.5, '#6a4a2c');
      barrel(ctx, T, -0.1, 0.48, 0, 14.5, 0.05, '#4a4a46');
      for (const k of [0.1, 0.3]) { const [rx, ry] = T(k, 0, 14.5); ell(ctx, rx, ry, 1.1, 1.1, '#3a3a36'); }
      banner(ctx, x0 + 0.2, y0 + 0.2, 12, 7, col, t, false);
      break;
    }
    case 'jp_turret': {
      // 鐵砲櫓
      ground();
      for (const [xx, yy] of [[x0 + 0.15, y0 + 0.15], [x1 - 0.22, y0 + 0.15], [x0 + 0.15, y1 - 0.22], [x1 - 0.22, y1 - 0.22]]) isoBox(ctx, xx, yy, xx + 0.07, yy + 0.07, 0, 8, '#3a2e24');
      line(ctx, P(x0 + 0.18, y1 - 0.18, 1), P(x1 - 0.18, y1 - 0.18, 7), '#3a2e24', 0.5);
      line(ctx, P(x1 - 0.18, y0 + 0.18, 1), P(x1 - 0.18, y1 - 0.18, 7), '#3a2e24', 0.5);
      mWalls(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 8, 13, S, { lowerPanel: true, cols: 2, rows: 2 });
      // 狹間(射擊孔)
      const [hx, hy] = FSW(x0 + 0.1, x1 - 0.1, y1 - 0.1)(0.5, 10); pix(ctx, hx - 0.8, hy - 0.5, 1.6, 1, '#111');
      const T = lframe(b.x, b.y, b.tdir);
      barrel(ctx, T, 0.2, 0.6, 0, 10.2, 0.015, '#3a2a1a');
      hipRoof(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 13, 4.5, S, 0.15, 2);
      banner(ctx, x1 - 0.1, y1 - 0.1, 13, 6, col, t, true);
      break;
    }
    case 'kr_turret': {
      // 箭樓
      ground();
      for (const [xx, yy] of [[x0 + 0.18, y0 + 0.18], [x1 - 0.25, y0 + 0.18], [x0 + 0.18, y1 - 0.25], [x1 - 0.25, y1 - 0.25]]) isoBox(ctx, xx, yy, xx + 0.07, yy + 0.07, 0, 14, S.wood);
      for (let z = 3; z < 13; z += 4) { line(ctx, P(x0 + 0.2, y1 - 0.2, z), P(x1 - 0.2, y1 - 0.2, z + 3), shade(S.wood, 0.8), 0.4); line(ctx, P(x1 - 0.2, y0 + 0.2, z), P(x1 - 0.2, y1 - 0.2, z + 3), shade(S.wood, 0.7), 0.4); }
      isoBox(ctx, x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05, 14, 15, '#7a5a3a');
      railing(ctx, x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05, 15);
      // 弓手
      const T = lframe(b.x, b.y, b.tdir);
      const [ax, ay] = T(0, 0, 15);
      pix(ctx, ax - 1, ay - 5, 2, 4, '#ece6d8'); circ(ctx, ax, ay - 6, 0.8, '#d8a984'); ell(ctx, ax, ay - 6.6, 1.8, 0.5, '#1a1a1a');
      const [tx, ty] = T(0.3, 0, 18.5);
      ctx.strokeStyle = '#5a3c22'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(ax, ay - 2.5); ctx.quadraticCurveTo(tx, ty, ax + (tx - ax) * 0.3, ay - 6.5); ctx.stroke();
      for (const [xx, yy] of [[x0 + 0.05, y0 + 0.05], [x1 - 0.05, y1 - 0.05], [x1 - 0.05, y0 + 0.05]]) line(ctx, P(xx, yy, 15), P(xx, yy, 18.5), S.wood, 0.7);
      hipRoof(ctx, x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05, 18.5, 4, S, 0.12, 2);
      break;
    }
    case 'mg_super': case 'jp_super': case 'kr_super': {
      ground();
      stoneBase(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0, 2.5, '#8a8478');
      const ready = b.charge >= b.def.charge, fr = clamp(b.charge / b.def.charge, 0, 1);
      if (b.type === 'mg_super') {
        // 火龍出水發射架
        const Q = lframe(b.x, b.y, -Math.PI * 0.75);
        prism(ctx, Q, rect(-0.6, -0.15, 0.5, 0.15), rect(-0.6, -0.15, 0.5, 0.15), 2.5, 4, '#6a4a2c');
        line(ctx, Q(-0.5, 0, 4), Q(0.45, 0, 4 + 14), '#5a3c22', 1.6);
        line(ctx, Q(0.1, -0.12, 4), Q(0.3, 0, 14), '#5a3c22', 0.6); line(ctx, Q(0.1, 0.12, 4), Q(0.3, 0, 14), '#5a3c22', 0.6);
        if (fr > 0.6) {
          const a = Q(-0.4, 0, 5.5 + 1), c = Q(0.4, 0, 5.5 + 13);
          ctx.lineCap = 'round'; line(ctx, a, c, '#c83020', 2.6); line(ctx, a, c, '#e8b030', 0.6); ctx.lineCap = 'butt';
          // 龍首
          poly(ctx, [[c[0] - 1.5, c[1] + 0.5], [c[0] + 2.5, c[1] - 2], [c[0] + 0.6, c[1] + 1.8]], '#e8b030');
          circ(ctx, c[0] + 0.6, c[1] - 0.5, 0.35, '#111');
          for (const s of [-1, 1]) line(ctx, Q(-0.1, s * 0.05, 9), Q(-0.2, s * 0.15, 8), '#c83020', 0.6);
        }
        for (let k = 0; k < 4; k++) brazier(ctx, k % 2 ? x1 - 0.2 : x0 + 0.2, k < 2 ? y0 + 0.2 : y1 - 0.2, 2.5, t + k);
      } else if (b.type === 'jp_super') {
        // 鳥居與火盆
        const red = '#c8341e';
        for (const xx of [x0 + 0.45, x1 - 0.45]) isoCyl(ctx, xx, b.y + 0.3, 0.07, 2.5, 18, red, shade(red, 1.1));
        line(ctx, P(x0 + 0.3, b.y + 0.3, 17), P(x1 - 0.3, b.y + 0.3, 17), red, 1.4);
        line(ctx, P(x0 + 0.15, b.y + 0.3, 19.5), P(x1 - 0.15, b.y + 0.3, 19.5), '#1a1a1a', 1.8);
        for (let k = 0; k < 4; k++) brazier(ctx, k % 2 ? x1 - 0.25 : x0 + 0.25, k < 2 ? y0 + 0.25 : y1 - 0.25, 2.5, t + k * 1.3);
        if (ready) { const [cx, cy] = P(b.x, b.y, 8); glow(ctx, cx, cy, 14, '#ff5010', 0.5 + 0.3 * Math.sin(t * 6)); }
      } else {
        // 神機箭陣:三台華車
        for (let k = 0; k < 3; k++) {
          const fake = { id: k + b.id, x: x0 + 0.45 + k * 0.55, y: y1 - 0.5 - k * 0.3, dir: -Math.PI * 0.75, tdir: -Math.PI * 0.75, moving: false, anim: 0, cool: ready ? 0 : 99, weapon: { rof: 6 }, def: { look: { kind: 'cart', variant: 'hwacha', L: 0.7, W: 0.45, H: 5 } }, owner: b.owner };
          R.zs = 1; drawCartUnit(ctx, fake, col, true);
        }
      }
      // 充能燈籠
      const sw = FSW(x0 + 0.1, x1 - 0.1, y1 - 0.1);
      for (let k = 0; k < 8; k++) { const [lx, ly] = sw(0.08 + k * 0.12, 1.4); ell(ctx, lx, ly, 0.6, 0.8, k / 8 < fr ? (ready ? '#ff3020' : '#ffa030') : '#3a2a20'); }
      break;
    }
  }
}

// ---------- 古代兵種 ----------
function mingPalette(u) {
  const f = G.players[u.owner].faction, col = G.players[u.owner].color, S = MSTYLE[f] || MSTYLE.mg;
  if (f === 'mg') return { f, cloth: col, armor: '#6a2a20', pants: '#3a2a22', trim: '#d8b040', skin: '#d8a984' };
  if (f === 'jp') return { f, cloth: S.cloth, armor: u.def.look.gun === 'katana' ? '#2a2420' : '#3a3530', pants: '#2c3448', trim: '#c8302a', skin: '#d8a984' };
  return { f, cloth: S.cloth, armor: col, pants: '#d8d2c4', trim: '#2a2a2a', skin: '#d8a984' };
}
function drawHat(ctx, hat, hx, hy, pal, col, dx) {
  switch (hat) {
    case 'jingasa': poly(ctx, [[hx - 3, hy - 0.2], [hx, hy - 2.2], [hx + 3, hy - 0.2]], '#2a2622'); line(ctx, [hx - 3, hy - 0.2], [hx + 3, hy - 0.2], '#4a4440', 0.35); circ(ctx, hx, hy - 1.2, 0.4, '#c8302a'); break;
    case 'kabuto':
      ctx.fillStyle = '#22201e'; ctx.beginPath(); ctx.ellipse(hx, hy - 0.4, 1.9, 1.7, 0, Math.PI, 0); ctx.fill();
      pix(ctx, hx - 2.4, hy - 0.4, 4.8, 0.7, '#2e2a26');
      ctx.strokeStyle = '#e8c040'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(hx - 1.8, hy - 3.4); ctx.lineTo(hx, hy - 1.6); ctx.lineTo(hx + 1.8, hy - 3.4); ctx.stroke();
      break;
    case 'gat':
      ell(ctx, hx, hy - 0.3, 2.9, 0.8, '#1a1a1a');
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(hx, hy - 0.5, 1.4, 1.5, 0, Math.PI, 0); ctx.fill();
      circ(ctx, hx, hy - 2.1, 0.55, '#c8302a');
      break;
    case 'cap': ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(hx, hy - 0.4, 1.6, 1.3, 0, Math.PI, 0); ctx.fill(); break;
    default: // 明軍鐵盔 + 紅纓
      ctx.fillStyle = vgrad(ctx, hy, hy - 2, '#3a3a3a', '#7a7a7a'); ctx.beginPath(); ctx.ellipse(hx, hy - 0.4, 1.7, 1.8, 0, Math.PI, 0); ctx.fill();
      line(ctx, [hx, hy - 2.2], [hx, hy - 3], '#888', 0.3);
      ctx.fillStyle = '#e02a1a'; ctx.beginPath(); ctx.moveTo(hx, hy - 3); ctx.quadraticCurveTo(hx - dx * 2, hy - 3.5, hx - dx * 1.6, hy - 1.6); ctx.lineTo(hx, hy - 2.6); ctx.fill();
  }
}
function drawSoldierMing(ctx, u, col) {
  const [sx, sy] = P(u.x, u.y, 0);
  const pal = mingPalette(u), gun = u.def.look.gun;
  const hat = u.def.look.hat || (gun === 'none' ? 'cap' : pal.f === 'mg' ? 'mg' : pal.f === 'jp' ? 'jingasa' : 'gat');
  const fx = Math.cos(u.dir) - Math.sin(u.dir), fy = (Math.cos(u.dir) + Math.sin(u.dir)) / 2;
  const fl = Math.hypot(fx, fy) || 1, dx = fx / fl, dy = fy / fl;
  const away = dy < -0.15;
  const walk = u.moving ? Math.sin(u.anim * 2) : 0;
  const atk = u.weapon && u.cool > u.weapon.rof - 0.3 ? (u.cool - (u.weapon.rof - 0.3)) / 0.3 : 0;
  softShadow(ctx, u.x, u.y, 4, 1.8, 0.4);
  const hipY = sy - 5.2;
  for (const sd of [-1, 1]) {
    const sw = walk * sd;
    const kx = sx + sd * 0.8 + dx * sw * 0.6, ky = hipY + 2.6;
    const fx2 = sx + sd * 0.9 + dx * sw * 1.6, fy2 = sy - 0.4 + dy * sw * 0.5 - Math.max(0, sw) * 0.6;
    ctx.lineCap = 'round';
    line(ctx, [sx + sd * 0.7, hipY], [kx, ky], sd > 0 ? pal.pants : shade(pal.pants, 0.7), 1.3);
    line(ctx, [kx, ky], [fx2, fy2], '#e8e2d2', 1.1); // 綁腿
    ctx.lineCap = 'butt';
    ell(ctx, fx2 + dx * 0.4, fy2 + 0.2, 0.9, 0.5, '#2a2018');
  }
  const top = sy - 10.2;
  const back = () => {
    if (pal.f === 'jp' && gun !== 'none') {
      // 背旗(指物)
      const bx = sx - dx * 1.2;
      line(ctx, [bx, top + 2], [bx, top - 9], '#3a2a1a', 0.35);
      const wv = Math.sin(G.time * 5 + u.id) * 0.4;
      poly(ctx, [[bx, top - 9], [bx + 2.6 + wv, top - 9], [bx + 2.6 + wv, top - 3.5], [bx, top - 3.5]], col);
      circ(ctx, bx + 1.3 + wv / 2, top - 6.2, 0.8, '#c8302a');
    }
    if (gun === 'bow') { line(ctx, [sx - dx * 1.6 - 0.8, top + 4], [sx - dx * 1.6 + 1, top - 1], '#6a3a20', 1.2); for (let k = 0; k < 3; k++) line(ctx, [sx - dx * 1.6 + 0.6 + k * 0.3, top - 0.8], [sx - dx * 1.6 + 0.8 + k * 0.3, top - 2.2], '#e8e2d2', 0.25); }
  };
  const weapon = () => {
    const hx = sx + dx * 1.5, hy = top + 3.2 + dy * 0.6;
    switch (gun) {
      case 'musket': {
        const tx = hx + dx * 5.5, ty = hy + dy * 2.4 - 1, bx2 = hx - dx * 2.6, by2 = hy - dy * 1 + 0.5;
        line(ctx, [bx2, by2], [hx, hy], '#6a4428', 1.1);
        line(ctx, [hx, hy], [tx, ty], '#2a2a2a', 0.6);
        circ(ctx, hx - dx * 0.4, hy - 0.3, 0.3, Math.sin(G.time * 8 + u.id) > 0 ? '#ff6020' : '#c03010');
        if (atk > 0.5) { glow(ctx, tx + dx, ty + dy * 0.5, 4, '#fff0a0', 1); }
        break;
      }
      case 'bow': {
        const bx2 = sx + dx * 2.6, by2 = top + 3;
        ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(bx2 - dy * 0.5, by2 - 4.5); ctx.quadraticCurveTo(bx2 + dx * 2.2, by2, bx2 - dy * 0.5, by2 + 4.5); ctx.stroke();
        const pull = atk > 0 ? 0 : 1.5;
        line(ctx, [bx2 - dy * 0.5, by2 - 4.5], [bx2 - dx * pull, by2], '#e8e2d2', 0.2); line(ctx, [bx2 - dx * pull, by2], [bx2 - dy * 0.5, by2 + 4.5], '#e8e2d2', 0.2);
        if (atk === 0) line(ctx, [bx2 - dx * pull, by2], [bx2 + dx * 3, by2 + dy], '#c8b080', 0.3);
        break;
      }
      case 'spear': {
        const thrust = atk * 2.5;
        const bx2 = hx - dx * 5, by2 = hy + 2, tx = hx + dx * (9 + thrust), ty = hy - 6 + dy * 3;
        line(ctx, [bx2, by2], [tx, ty], '#7a5a34', 0.6);
        poly(ctx, [[tx, ty], [tx - dx * 2 - 0.5, ty + 1.2], [tx - dx * 2 + 0.5, ty + 0.4]], '#d0d4d8');
        if (pal.f === 'mg') for (let k = 0; k < 4; k++) { const px = tx - dx * (3 + k), py = ty + 0.9 * (3 + k) * 0.6; line(ctx, [px, py], [px + (k % 2 ? 1 : -1) * 1.2, py - 1.2], '#4a6a2a', 0.3); }
        if (pal.f === 'mg') { poly(ctx, [[tx - dx * 2, ty + 1.3], [tx - dx * 2.5, ty + 2.2], [tx - dx * 1.5, ty + 2]], '#e02a1a'); }
        break;
      }
      case 'katana': case 'sword': {
        const ang = atk > 0 ? -1.4 + (1 - atk) * 2.4 : -0.6;
        const L = gun === 'katana' ? 6 : 5;
        const ex = hx + Math.cos(ang) * L * (dx >= 0 ? 1 : -1), ey = hy + Math.sin(ang) * L;
        ctx.strokeStyle = '#e4e8ec'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + ex) / 2 + (gun === 'katana' ? 0.6 : 0), (hy + ey) / 2 - 0.6, ex, ey); ctx.stroke();
        line(ctx, [hx - 0.8, hy + 0.4], [hx + 0.8, hy - 0.4], '#c8a040', 0.5);
        if (gun === 'sword') {
          const shx = sx - dx * 0.6 + dy * 1.2, shy = top + 3.5;
          circ(ctx, shx, shy, 2.2, '#6a4a2c'); circ(ctx, shx, shy, 1.6, col); circ(ctx, shx, shy, 0.5, '#d8b040');
        }
        break;
      }
      case 'none': {
        line(ctx, [hx, hy], [hx + dx * 2.5, hy - 2.5], '#6a4a2c', 0.5);
        pix(ctx, hx + dx * 2.5 - 0.8, hy - 3.2, 1.6, 1.1, '#555');
        ctx.fillStyle = '#8a6a40'; ctx.fillRect(sx - dx * 1.8 - 1, top + 3, 2, 2.2);
        break;
      }
    }
  };
  if (!away) back(); else weapon();
  // 軀幹:袍服 + 甲
  ctx.fillStyle = vgrad(ctx, top + 6, top, shade(pal.cloth, 0.75), pal.cloth);
  ctx.beginPath(); ctx.moveTo(sx - 2.1, top + 0.5); ctx.lineTo(sx + 2.1, top + 0.5); ctx.lineTo(sx + 2.6, top + 6.2); ctx.lineTo(sx - 2.6, top + 6.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = vgrad(ctx, top + 4.5, top + 0.5, shade(pal.armor, 0.75), pal.armor);
  ctx.beginPath(); ctx.roundRect(sx - 1.8, top + 0.6, 3.6, 3.8, 0.6); ctx.fill();
  if (pal.f === 'mg') for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) circ(ctx, sx - 1.2 + c * 1.2, top + 1.3 + r * 1.1, 0.22, '#e8c050');
  else for (let r = 1; r < 4; r++) line(ctx, [sx - 1.7, top + 0.6 + r * 0.95], [sx + 1.7, top + 0.6 + r * 0.95], pal.f === 'jp' ? col : shade(pal.armor, 0.6), 0.25);
  pix(ctx, sx - 2, top + 4.3, 4, 0.5, pal.trim);
  // 手臂
  ctx.lineCap = 'round';
  line(ctx, [sx - 1.9, top + 1.1], [sx - 1.2 + dx * 1.6, top + 3.7 + dy], shade(pal.cloth, 0.7), 1);
  line(ctx, [sx + 1.9, top + 1.1], [sx + 0.9 + dx * 2.2, top + 3.3 + dy], pal.cloth, 1);
  ctx.lineCap = 'butt';
  const hy = top - 1.8;
  circ(ctx, sx + dx * 0.2, hy, 1.35, pal.skin);
  if (!away) pix(ctx, sx + dx * 0.9 - 0.2, hy - 0.2, 0.4, 0.4, '#1a1a1a');
  drawHat(ctx, hat, sx + dx * 0.2, hy, pal, col, dx);
  if (!away) weapon(); else back();
}

function drawHorse(ctx, u, col) {
  const pal = mingPalette(u), lk = u.def.look;
  const Q = lframe(u.x, u.y, u.dir);
  const run = u.moving ? u.anim * 1.3 : 0, gal = u.moving ? 1 : 0;
  shadowPoly(ctx, Q, rect(-0.3, -0.1, 0.42, 0.1), 0.3);
  const coat = ['#5a3a24', '#2e2622', '#8a6440', '#cfc6b4', '#6a5040'][u.id % 5], dark = shade(coat, 0.7);
  const legs = [[0.17, 0.06, 0], [0.17, -0.06, 1.6], [-0.2, 0.06, 3.1], [-0.2, -0.06, 4.7]];
  const near = sideVisible(Q, 1) ? 1 : -1;
  const drawLeg = ([lx, ly, ph]) => {
    const s = Math.sin(run + ph) * gal, c = Math.max(0, Math.cos(run + ph)) * gal;
    const top = Q(lx, ly, 6.8), knee = Q(lx + s * 0.05, ly, 3.4 + c * 1.2), foot = Q(lx + s * 0.09, ly, c * 1.4);
    const cl = Math.sign(ly) === near ? coat : dark;
    ctx.lineCap = 'round'; line(ctx, top, knee, cl, 1.2); line(ctx, knee, foot, cl, 0.8); ctx.lineCap = 'butt';
    pix(ctx, foot[0] - 0.5, foot[1] - 0.4, 1, 0.6, '#1a1a1a');
  };
  for (const l of legs) if (Math.sign(l[1]) !== near) drawLeg(l);
  const bob = gal * Math.sin(run * 2) * 0.5;
  // 尾
  const ta = Q(-0.27, 0, 8.4 + bob), tb = Q(-0.36, Math.sin(G.time * 3 + u.id) * 0.05, 3.5);
  ctx.strokeStyle = shade(coat, 0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ta[0], ta[1]); ctx.quadraticCurveTo(ta[0] + (tb[0] - ta[0]) * 0.2, ta[1] + 1, tb[0], tb[1]); ctx.stroke();
  // 身體
  const b0 = Q(-0.24, 0, 7.5 + bob), b1 = Q(0.18, 0, 7.9 + bob);
  ctx.lineCap = 'round';
  line(ctx, b0, b1, dark, 5); line(ctx, [b0[0], b0[1] - 0.6], [b1[0], b1[1] - 0.6], coat, 4); line(ctx, [b0[0], b0[1] - 1.6], [b1[0], b1[1] - 1.6], shade(coat, 1.25), 1.2);
  // 頸與頭
  const n0 = Q(0.17, 0, 8.6 + bob), n1 = Q(0.3, 0, 12.4 + bob), h1 = Q(0.43, 0, 10.6 + bob);
  line(ctx, n0, n1, coat, 2.6); line(ctx, n1, h1, coat, 1.9);
  line(ctx, [n0[0] - 0.5, n0[1] - 1.2], [n1[0] - 0.5, n1[1] - 1], shade(coat, 0.4), 0.7);
  ctx.lineCap = 'butt';
  circ(ctx, n1[0] + (h1[0] - n1[0]) * 0.3, n1[1] + (h1[1] - n1[1]) * 0.3 - 0.4, 0.3, '#111');
  poly(ctx, [[n1[0] - 0.3, n1[1] - 0.8], [n1[0] + 0.2, n1[1] - 2], [n1[0] + 0.5, n1[1] - 0.7]], shade(coat, 0.8));
  // 鞍韉
  poly(ctx, [Q(-0.1, -0.11, 7.2 + bob), Q(0.08, -0.11, 7.2 + bob), Q(0.08, 0.11, 7.2 + bob), Q(-0.1, 0.11, 7.2 + bob)].map(p => [p[0], p[1] - 2]), col);
  for (const sd of [-1, 1]) if (sd === near) poly(ctx, [Q(-0.1, sd * 0.1, 9 + bob), Q(0.08, sd * 0.1, 9 + bob), Q(0.08, sd * 0.1, 5.5 + bob), Q(-0.1, sd * 0.1, 5.5 + bob)], col);
  for (const l of legs) if (Math.sign(l[1]) === near) drawLeg(l);
  // 騎手
  const [rx, ry] = Q(-0.02, 0, 9.5 + bob);
  const tdx = Math.cos(u.tdir) - Math.sin(u.tdir), tdy = (Math.cos(u.tdir) + Math.sin(u.tdir)) / 2, tl = Math.hypot(tdx, tdy) || 1;
  const wx = tdx / tl, wy = tdy / tl;
  const atk = u.weapon && u.cool > u.weapon.rof - 0.3 ? (u.cool - (u.weapon.rof - 0.3)) / 0.3 : 0;
  if (pal.f === 'jp') { line(ctx, [rx - wx, ry - 4], [rx - wx, ry - 13], '#3a2a1a', 0.35); poly(ctx, [[rx - wx, ry - 13], [rx - wx + 2.4, ry - 13], [rx - wx + 2.4, ry - 8], [rx - wx, ry - 8]], col); }
  line(ctx, [rx - 0.8, ry - 1], [rx - 1.2 + wx, ry + 2.2], pal.pants, 1);
  ctx.fillStyle = vgrad(ctx, ry, ry - 5, shade(pal.cloth, 0.75), pal.cloth);
  ctx.beginPath(); ctx.roundRect(rx - 1.7, ry - 5.2, 3.4, 5, 0.8); ctx.fill();
  ctx.fillStyle = pal.armor; ctx.beginPath(); ctx.roundRect(rx - 1.5, ry - 4.8, 3, 3, 0.5); ctx.fill();
  circ(ctx, rx + wx * 0.2, ry - 6.6, 1.25, pal.skin);
  drawHat(ctx, pal.f === 'mg' ? 'mg' : pal.f === 'jp' ? 'kabuto' : 'gat', rx + wx * 0.2, ry - 6.6, pal, col, wx);
  if (lk.rider === 'bow') {
    const bx = rx + wx * 2.2, by = ry - 3.5;
    ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.quadraticCurveTo(bx + wx * 2, by, bx, by + 4); ctx.stroke();
    line(ctx, [bx, by - 4], [bx - wx * (atk ? 0 : 1.4), by], '#e8e2d2', 0.2); line(ctx, [bx - wx * (atk ? 0 : 1.4), by], [bx, by + 4], '#e8e2d2', 0.2);
  } else {
    const thrust = atk * 0.25;
    const tip = P(u.x + Math.cos(u.tdir) * (0.62 + thrust), u.y + Math.sin(u.tdir) * (0.62 + thrust), 12 + bob);
    const butt = P(u.x - Math.cos(u.tdir) * 0.3, u.y - Math.sin(u.tdir) * 0.3, 8 + bob);
    line(ctx, butt, tip, '#6a4a2c', 0.55);
    poly(ctx, [tip, [tip[0] - wx * 2 - wy * 0.5, tip[1] - wy * 1 + 0.5], [tip[0] - wx * 2 + wy * 0.5, tip[1] - wy * 1 - 0.3]], '#d8dce0');
    if (pal.f === 'mg') poly(ctx, [[tip[0] - wx * 2.5, tip[1] - wy * 1.2], [tip[0] - wx * 5, tip[1] - wy * 2.5 - 0.5], [tip[0] - wx * 2.8, tip[1] - wy * 1.4 + 1.6]], '#e02a1a');
  }
}

function cartWheel(ctx, Q, lx, ly, z, r, spin) {
  const [wx, wy] = Q(lx, ly, z);
  ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(wx, wy, r * 0.75, r, 0, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = '#8a6440'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.ellipse(wx, wy, r * 0.62, r * 0.85, 0, 0, 6.283); ctx.stroke();
  for (let k = 0; k < 4; k++) { const a = spin + k * 0.785; line(ctx, [wx - Math.cos(a) * r * 0.7, wy - Math.sin(a) * r * 0.9], [wx + Math.cos(a) * r * 0.7, wy + Math.sin(a) * r * 0.9], '#6a4a2c', 0.35); }
  circ(ctx, wx, wy, r * 0.18, '#2a1a10');
}
function drawCrew(ctx, x, y, col, pal, dirx) {
  const [sx, sy] = P(x, y, 0);
  softShadow(ctx, x, y, 2.5, 1.2, 0.35);
  line(ctx, [sx - 0.6, sy - 4], [sx - 0.7, sy], pal.pants, 1); line(ctx, [sx + 0.6, sy - 4], [sx + 0.8, sy], pal.pants, 1);
  ctx.fillStyle = pal.cloth; ctx.beginPath(); ctx.roundRect(sx - 1.6, sy - 8.5, 3.2, 4.8, 0.6); ctx.fill();
  pix(ctx, sx - 1.6, sy - 5.2, 3.2, 0.4, pal.trim);
  circ(ctx, sx, sy - 9.8, 1.2, pal.skin);
  drawHat(ctx, pal.f === 'mg' ? 'mg' : pal.f === 'jp' ? 'jingasa' : 'gat', sx, sy - 9.8, pal, col, dirx);
  line(ctx, [sx + 1.5, sy - 7.5], [sx + 1.5 + dirx * 3, sy - 3], '#6a4a2c', 0.4);
}
function drawCartUnit(ctx, u, col, noCrew) {
  const lk = u.def.look, L = lk.L, W = lk.W, v = lk.variant;
  const pal = mingPalette(u);
  const Q = lframe(u.x, u.y, u.dir), T = lframe(u.x, u.y, u.tdir);
  const wood = '#7a5534';
  shadowPoly(ctx, Q, rect(-L / 2, -W / 2, L / 2, W / 2));
  const spin = (u.anim || 0) * 1.2;
  const near = sideVisible(Q, 1) ? 1 : -1;
  const wl = v === 'warcart' ? [0] : [-0.05];
  const wr = v === 'hwacha' || v === 'mortar' ? 2.6 : 3.4;
  for (const lx of wl) cartWheel(ctx, Q, lx * L, -near * W * 0.5, wr, wr, spin);
  // 車床
  prism(ctx, Q, rect(-L / 2, -W * 0.42, L / 2, W * 0.42), rect(-L / 2, -W * 0.42, L / 2, W * 0.42), wr - 1, wr + 0.6, wood, '#8a6440');
  for (let k = 1; k < 6; k++) line(ctx, Q(-L / 2 + k * L / 6, -W * 0.42, wr + 0.6), Q(-L / 2 + k * L / 6, W * 0.42, wr + 0.6), 'rgba(0,0,0,0.25)', 0.25);
  for (const s of [-1, 1]) line(ctx, Q(L / 2, s * 0.08, wr), Q(L / 2 + 0.25, s * 0.06, 1.5), '#5a3c22', 0.6);
  const zt = wr + 0.6;
  const charge = u.weapon ? clamp(1 - u.cool / u.weapon.rof, 0, 1) : 1;
  const rec = u.weapon && u.cool > u.weapon.rof - 0.15 ? -0.06 : 0;
  switch (v) {
    case 'warcart': {
      // 偏廂:側板屏風 + 佛郎機
      const side = -near;
      prism(ctx, Q, rect(-L * 0.48, side * W * 0.42 - 0.03, L * 0.48, side * W * 0.42 + 0.03), rect(-L * 0.48, side * W * 0.42 - 0.03, L * 0.48, side * W * 0.42 + 0.03), zt, zt + 8, '#8a5a34', '#6a4426');
      prism(ctx, Q, rect(-L * 0.48, near * W * 0.42 - 0.03, L * 0.48, near * W * 0.42 + 0.03), rect(-L * 0.48, near * W * 0.42 - 0.03, L * 0.48, near * W * 0.42 + 0.03), zt, zt + 3.5, '#8a5a34', '#6a4426');
      for (let k = 0; k < 3; k++) { const [px, py] = Q(-L * 0.3 + k * L * 0.3, near * W * 0.45, zt + 1.8); circ(ctx, px, py, 1.3, col); circ(ctx, px - 0.4, py - 0.3, 0.3, '#111'); circ(ctx, px + 0.4, py - 0.3, 0.3, '#111'); }
      for (const ly of [-0.08, 0.08]) barrel(ctx, T, 0, 0.45 + rec, ly, zt + 4.5, 0.03, '#3e3e3a');
      break;
    }
    case 'cannon': {
      const big = lk.big;
      for (const s of [-1, 1]) prism(ctx, Q, rect(-L * 0.45, s * W * 0.18 - 0.03, L * 0.2, s * W * 0.18 + 0.03), rect(-L * 0.45, s * W * 0.18 - 0.03, L * 0.15, s * W * 0.18 + 0.03), zt, zt + 3, '#6a4426');
      const r = big ? 0.085 : 0.06;
      barrel(ctx, T, -0.32 + rec, (big ? 0.6 : 0.45) + rec, 0, zt + 4, r, '#9a7a3a');
      for (const k of [-0.15, 0.1, 0.35]) { const [bx, by] = T(k + rec, 0, zt + 4); ell(ctx, bx, by, r * 32, r * 34, '#7a5a2a'); }
      const [cx, cy] = T(-0.36 + rec, 0, zt + 4); circ(ctx, cx, cy, 0.9, '#7a5a2a');
      break;
    }
    case 'catapult': {
      for (const s of [-1, 1]) { line(ctx, Q(-0.25, s * W * 0.3, zt), Q(0, s * W * 0.3, zt + 13), '#5a3c22', 0.9); line(ctx, Q(0.25, s * W * 0.3, zt), Q(0, s * W * 0.3, zt + 13), '#5a3c22', 0.9); }
      line(ctx, Q(0, -W * 0.3, zt + 12.5), Q(0, W * 0.3, zt + 12.5), '#3a2614', 0.8);
      const fired = u.weapon ? clamp((u.cool - (u.weapon.rof - 0.8)) / 0.8, 0, 1) : 0;
      const pv = T(0, 0, zt + 12.5);
      const rest = T(-0.5, 0, zt + 2), up = T(0.25, 0, zt + 24);
      const e = [rest[0] + (up[0] - rest[0]) * fired, rest[1] + (up[1] - rest[1]) * fired];
      const cw = [pv[0] - (e[0] - pv[0]) * 0.35, pv[1] - (e[1] - pv[1]) * 0.35];
      line(ctx, cw, e, '#6a4426', 1.1);
      pix(ctx, cw[0] - 1.8, cw[1] - 1, 3.6, 3, '#4a4a46');
      if (charge > 0.6) { glow(ctx, e[0], e[1], 3.5, '#ff7020', 0.8); circ(ctx, e[0], e[1], 1, '#3a2a1a'); }
      break;
    }
    case 'hwacha': {
      // 神機箭發射架(傾斜)
      const bot = rect(-0.22, -W * 0.38, 0.12, W * 0.38), top = rect(-0.1, -W * 0.38, 0.26, W * 0.38);
      prism(ctx, T, bot, top, zt + 0.5, zt + 9, '#7a5030', '#5a3820');
      const loaded = charge > 0.5;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
        const ly = -W * 0.34 + c * W * 0.68 / 5, z = zt + 1.5 + r * 1.6, lx = 0.12 + r * 0.028;
        const [px, py] = T(lx, ly, z);
        circ(ctx, px, py, 0.35, '#1a1210');
        if (loaded) { const [qx, qy] = T(lx + 0.06, ly, z + 0.4); line(ctx, [px, py], [qx, qy], '#c8b080', 0.25); pix(ctx, qx - 0.25, qy - 0.25, 0.5, 0.5, '#555'); }
      }
      if (loaded && Math.sin(G.time * 10 + u.id) > 0.7) { const [gx, gy] = T(-0.15, 0, zt + 5); glow(ctx, gx, gy, 2, '#ff8030', 0.8); }
      break;
    }
    case 'mortar': {
      prism(ctx, Q, rect(-0.2, -0.18, 0.2, 0.18), rect(-0.18, -0.16, 0.18, 0.16), zt, zt + 2, '#5a3c22');
      const a = T(0, 0, zt + 2), m = T(0.12, 0, zt + 9);
      ctx.lineCap = 'round'; line(ctx, a, m, '#6a5020', 6.5); line(ctx, a, m, '#9a7a3a', 5); line(ctx, [a[0] - 1.4, a[1]], [m[0] - 1.4, m[1]], '#c8a860', 1); ctx.lineCap = 'butt';
      ell(ctx, m[0], m[1], 2.6, 1.3, '#1a1408');
      for (const k of [0.3, 0.6]) { const p = [a[0] + (m[0] - a[0]) * k, a[1] + (m[1] - a[1]) * k]; line(ctx, [p[0] - 2.8, p[1]], [p[0] + 2.8, p[1]], '#5a4018', 0.6); }
      if (charge > 0.6) { const [bx, by] = Q(-0.3, near * 0.2, zt + 1); circ(ctx, bx, by, 1.2, '#2a2a2a'); circ(ctx, bx - 0.3, by - 0.3, 0.3, '#888'); }
      break;
    }
  }
  for (const lx of wl) cartWheel(ctx, Q, lx * L, near * W * 0.5, wr, wr, spin);
  if (!noCrew && v !== 'warcart') {
    const [cx, cy] = pt(Q, -L * 0.55, near * W * 0.6);
    drawCrew(ctx, cx, cy, col, pal, Math.cos(u.dir) - Math.sin(u.dir) > 0 ? 1 : -1);
  }
}
function drawOxCart(ctx, u, col) {
  const pal = mingPalette(u);
  const Q = lframe(u.x, u.y, u.dir);
  shadowPoly(ctx, Q, rect(-0.45, -0.25, 0.7, 0.25));
  const near = sideVisible(Q, 1) ? 1 : -1;
  const spin = (u.anim || 0) * 1.2, walk = u.moving ? u.anim : 0;
  // 牛
  const legs = [[0.65, 0.06, 0], [0.65, -0.06, 1.6], [0.42, 0.06, 3.1], [0.42, -0.06, 4.7]];
  const leg = ([lx, ly, ph]) => { const s = Math.sin(walk + ph) * 0.03; const a = Q(lx, ly, 4), b = Q(lx + s, ly, 0); ctx.lineCap = 'round'; line(ctx, a, b, Math.sign(ly) === near ? '#5a4030' : '#3a2a20', 1.1); ctx.lineCap = 'butt'; };
  for (const l of legs) if (Math.sign(l[1]) !== near) leg(l);
  ctx.lineCap = 'round';
  const o0 = Q(0.4, 0, 4.8), o1 = Q(0.66, 0, 5);
  line(ctx, o0, o1, '#3a2a1e', 5.4); line(ctx, [o0[0], o0[1] - 0.6], [o1[0], o1[1] - 0.6], '#5a4030', 4.2); line(ctx, [o0[0], o0[1] - 1.8], [o1[0], o1[1] - 1.8], '#7a5a40', 1.2);
  const hd = Q(0.76, 0, 4.4);
  line(ctx, o1, hd, '#4a3424', 2.6);
  ctx.lineCap = 'butt';
  for (const s of [-1, 1]) { ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(hd[0], hd[1] - 1.2); ctx.quadraticCurveTo(hd[0] + s * 1.5, hd[1] - 1.5, hd[0] + s * 1.6, hd[1] - 3); ctx.stroke(); }
  for (const l of legs) if (Math.sign(l[1]) === near) leg(l);
  // 車轅與軛
  for (const s of [-1, 1]) line(ctx, Q(0.2, s * 0.12, 3.5), Q(0.62, s * 0.1, 6), '#5a3c22', 0.5);
  line(ctx, Q(0.6, -0.14, 6.3), Q(0.6, 0.14, 6.3), '#5a3c22', 0.8);
  // 車
  cartWheel(ctx, Q, -0.12, -near * 0.27, 3.2, 3.2, spin);
  prism(ctx, Q, rect(-0.45, -0.24, 0.2, 0.24), rect(-0.45, -0.24, 0.2, 0.24), 2.4, 3.6, '#7a5534', '#8a6440');
  const box = prism(ctx, Q, rect(-0.45, -0.24, 0.2, 0.24), rect(-0.47, -0.26, 0.22, 0.26), 3.6, 6.4, '#8a6440', '#2e241a');
  void box;
  const fill = clamp((u.cargo || 0) / HARV_CAP, 0, 1);
  if (fill > 0.03 && u.cargoKind === 'wood') {
    const n = 1 + Math.round(fill * 5);
    for (let k = 0; k < n; k++) {
      const row = k % 3, lay = Math.floor(k / 3);
      const a = Q(-0.42, -0.14 + row * 0.14, 6.6 + lay * 1.6), b = Q(0.18, -0.14 + row * 0.14, 6.6 + lay * 1.6);
      ctx.lineCap = 'round'; line(ctx, a, b, '#6a4a2c', 2); line(ctx, [a[0], a[1] - 0.5], [b[0], b[1] - 0.5], '#9a7448', 0.6); ctx.lineCap = 'butt';
      ell(ctx, b[0], b[1], 1, 1, '#d0a874'); ell(ctx, b[0], b[1], 0.45, 0.45, '#a07848');
    }
  } else if (fill > 0.03 && u.cargoKind === 'stone') {
    const n = 2 + Math.round(fill * 6);
    for (let k = 0; k < n; k++) {
      const [px, py] = Q(-0.35 + (k % 4) * 0.16, -0.12 + Math.floor(k / 4) * 0.16, 6.6 + Math.floor(k / 4) * 1.2);
      poly(ctx, [[px - 1.6, py], [px - 0.6, py - 1.6], [px + 1.4, py - 1.2], [px + 1.6, py + 0.6], [px, py + 1]], k % 2 ? '#8a857c' : '#a6a196');
    }
  } else if (fill > 0.03) {
    const [ox, oy] = Q(-0.12, 0, 6.4 + fill * 1.5);
    const r = 3 + fill * 3;
    ctx.fillStyle = vgrad(ctx, oy + 1, oy - r * 0.6, '#6a6e74', '#d8dce2');
    ctx.beginPath(); ctx.ellipse(ox, oy + 0.5, r, r * 0.55, 0, 0, 6.283); ctx.fill();
    for (let k = 0; k < 7; k++) circ(ctx, ox + (hash(u.id + k) - 0.5) * r * 1.4, oy + (hash(u.id * 3 + k) - 0.5) * r * 0.6, 0.35, '#ffffff');
  }
  for (const s of [-1, 1]) if (sideVisible(Q, s)) poly(ctx, [Q(-0.4, s * 0.26, 4.2), Q(0.15, s * 0.26, 4.2), Q(0.15, s * 0.26, 5.6), Q(-0.4, s * 0.26, 5.6)], col);
  cartWheel(ctx, Q, -0.12, near * 0.27, 3.2, 3.2, spin);
  // 車夫
  const [dx, dy] = pt(Q, 0.22, 0);
  const [px, py] = P(dx, dy, 4);
  ctx.fillStyle = pal.cloth; ctx.beginPath(); ctx.roundRect(px - 1.4, py - 4.5, 2.8, 4, 0.6); ctx.fill();
  circ(ctx, px, py - 5.6, 1.1, pal.skin); drawHat(ctx, 'cap', px, py - 5.6, pal, col, 1);
  if ((u.moving || u.hstate === 'harvest') && Math.random() < 0.1) G.effects.push({ k: 'part', x: u.x, y: u.y, z: 1, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), vz: 10, c: '#555', t: 0, dur: 0.4 });
}

function drawUnitMing(ctx, u, col) {
  const lk = u.def.look;
  if (lk.kind === 'inf') drawSoldierMing(ctx, u, col);
  else if (lk.kind === 'horse') drawHorse(ctx, u, col);
  else if (lk.kind === 'harv') drawOxCart(ctx, u, col);
  else drawCartUnit(ctx, u, col);
}
