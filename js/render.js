'use strict';
// ===== 渲染核心(邏輯座標:1 單位 = 原始像素;實際以 R.res 倍解析度繪製)=====
const R = {
  camX: 0, camY: 0, ctx: null, cv: null, w: 0, h: 0, zs: 1,
  terrain: null, miniTerrain: null, ox: MAP_H * HW, RT: 2,
  zoom: 2, res: 2, sprites: new Map(), fogCv: null
};

function P(x, y, z = 0) {
  return [(x - y) * HW - R.camX, (x + y) * HH - R.camY - z * R.zs];
}
function worldToScreen(x, y) { return P(x, y, 0); }
function screenToWorld(sx, sy) {
  const ix = sx + R.camX, iy = sy + R.camY;
  return [(ix / HW + iy / HH) / 2, (iy / HH - ix / HW) / 2];
}
function centerCamera(x, y) {
  R.camX = (x - y) * HW - R.w / 2;
  R.camY = (x + y) * HH - R.h / 2;
  clampCamera();
}
function clampCamera() {
  const m = 40;
  R.camX = clamp(R.camX, -MAP_H * HW - m, Math.max(-MAP_H * HW - m, MAP_W * HW - R.w + m));
  R.camY = clamp(R.camY, -m, Math.max(-m, (MAP_W + MAP_H) * HH - R.h + m + 40));
}

// ===== 基本圖元 =====
function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}
function polyStroke(ctx, pts, col, w, close = true) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
  ctx.stroke();
}
function line(ctx, a, b, col, w = 1) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
function pix(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, 6.2832); ctx.fill(); }
function vgrad(ctx, yb, yt, cb, ct) {
  const g = ctx.createLinearGradient(0, yb, 0, yt);
  g.addColorStop(0, cb); g.addColorStop(1, ct);
  return g;
}
function glow(ctx, x, y, r, col, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  pushA(ctx, a); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  popA(ctx);
}
const _aStack = [];
function pushA(ctx, a) { _aStack.push(ctx.globalAlpha); ctx.globalAlpha = clamp(ctx.globalAlpha * a, 0, 1); }
function popA(ctx) { ctx.globalAlpha = _aStack.length ? _aStack.pop() : 1; }
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }

// 軸對齊等角方塊(含漸層、邊緣高光)
function isoBox(ctx, x0, y0, x1, y1, z0, z1, col, topCol, opt) {
  const sw = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
  const se = [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)];
  const top = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
  if (z1 - z0 > 0.8) {
    const yb = sw[1][1], yt = sw[2][1];
    poly(ctx, sw, vgrad(ctx, yb, yt, shade(col, 0.6), shade(col, 0.84)));
    poly(ctx, se, vgrad(ctx, yb, yt, shade(col, 0.42), shade(col, 0.64)));
  }
  poly(ctx, top, topCol || col);
  if (!opt || !opt.flat) {
    pushA(ctx, 0.5);
    polyStroke(ctx, [top[3], top[0], top[1]], 'rgba(255,255,255,0.35)', 0.4, false);
    polyStroke(ctx, [top[3], top[2], top[1]], 'rgba(255,255,255,0.55)', 0.4, false);
    if (z1 - z0 > 0.8) line(ctx, sw[1], sw[2], 'rgba(255,255,255,0.3)', 0.35);
    popA(ctx);
  }
  return { sw, se, top };
}
// 圓柱(世界座標)
function isoCyl(ctx, cx, cy, r, z0, z1, col, topCol, rings) {
  const rx = r * HW * 1.414, ry = r * HH * 1.414;
  const [bx, by] = P(cx, cy, z0), [tx, ty] = P(cx, cy, z1);
  const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
  g.addColorStop(0, shade(col, 0.72)); g.addColorStop(0.35, shade(col, 0.95)); g.addColorStop(0.6, shade(col, 0.7)); g.addColorStop(1, shade(col, 0.42));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI); ctx.lineTo(tx - rx, ty); ctx.ellipse(tx, ty, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  if (rings) for (let k = 1; k < rings; k++) {
    const z = z0 + (z1 - z0) * k / rings, [, ry2] = P(cx, cy, z);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.ellipse(bx, ry2, rx, ry, 0, 0, Math.PI); ctx.stroke();
  }
  ell(ctx, tx, ty, rx, ry, topCol || shade(col, 1.1));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
}

// 局部座標框架:lx 往前、ly 往側
function lframe(cx, cy, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const f = (lx, ly, z = 0) => P(cx + lx * c - ly * s, cy + lx * s + ly * c, z);
  f.c = c; f.s = s; f.cx = cx; f.cy = cy;
  return f;
}
function rect(x0, y0, x1, y1) { return [[x1, y0], [x1, y1], [x0, y1], [x0, y0]]; }
// 柱體:bot/top 為局部多邊形(點數相同),可做斜面
function prism(ctx, Q, bot, top, z0, z1, col, topCol, opt = {}) {
  const n = bot.length;
  let cx = 0, cy = 0;
  for (const p of bot) { cx += p[0] / n; cy += p[1] / n; }
  const faces = [];
  for (let i = 0; i < n; i++) {
    const a = bot[i], b = bot[(i + 1) % n], at = top[i], bt = top[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
    const wx = mx * Q.c - my * Q.s, wy = mx * Q.s + my * Q.c;
    if (wx + wy <= 0.0001) continue;
    const l = Math.hypot(wx, wy) || 1;
    faces.push({ pts: [Q(a[0], a[1], z0), Q(b[0], b[1], z0), Q(bt[0], bt[1], z1), Q(at[0], at[1], z1)], f: 0.62 + 0.2 * (wy - wx) / l, d: wx + wy, i });
  }
  faces.sort((p, q) => p.d - q.d);
  for (const fc of faces) poly(ctx, fc.pts, shade(col, fc.f));
  const tp = top.map(p => Q(p[0], p[1], z1));
  poly(ctx, tp, topCol || col);
  if (opt.edge !== false) {
    pushA(ctx, 0.6);
    for (const fc of faces) line(ctx, fc.pts[3], fc.pts[2], 'rgba(255,255,255,0.4)', 0.3);
    popA(ctx);
  }
  if (opt.outline) polyStroke(ctx, tp, 'rgba(0,0,0,0.35)', 0.3);
  return { faces, tp };
}
function shadowPoly(ctx, Q, pts, a = 0.32) {
  pushA(ctx, a);
  poly(ctx, pts.map(p => { const q = Q(p[0], p[1], 0); return [q[0] + 1.5, q[1] + 0.8]; }), '#000');
  popA(ctx);
}
function softShadow(ctx, x, y, rx, ry, a = 0.35) {
  const [sx, sy] = P(x, y, 0);
  const g = ctx.createRadialGradient(sx + 1, sy + 0.5, 0, sx + 1, sy + 0.5, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(sx + 1, sy + 0.5, rx, ry, 0, 0, 6.2832); ctx.fill();
}
// 舊介面相容
function rotBox(ctx, cx, cy, ang, L, W, z0, z1, col, topCol) {
  const Q = lframe(cx, cy, ang), r = rect(-L / 2, -W / 2, L / 2, W / 2);
  return prism(ctx, Q, r, r, z0, z1, col, topCol);
}
function shadow(ctx, x, y, rx, ry) { softShadow(ctx, x, y, rx, ry); }

// ===== 精靈快取(靜態物件)=====
function spriteCached(key, w, h, ax, ay, drawFn) {
  let s = R.sprites.get(key);
  if (!s || s.res !== R.res) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * R.res); cv.height = Math.ceil(h * R.res);
    const c = cv.getContext('2d');
    c.setTransform(R.res, 0, 0, R.res, 0, 0);
    drawFn(c, ax, ay);
    s = { cv, res: R.res, w, h, ax, ay };
    R.sprites.set(key, s);
  }
  return s;
}

// ===== 地形預渲染(2 倍解析度,含細節)=====
const TERRAIN_COLS = {
  [T_GRASS]: ['#567f38', '#5e8a3e', '#47702f', '#74a24a', '#3d6228'],
  [T_SAND]: ['#bca76c', '#c8b47c', '#a8945c', '#d8c690', '#9a8550'],
  [T_WATER]: ['#1d4b74', '#22578a', '#183f63', '#3a7aae', '#123352'],
  [T_ROCK]: ['#567f38', '#5e8a3e', '#47702f', '#74a24a', '#3d6228'],
  [T_TREE]: ['#4d7633', '#557f38', '#406a2c', '#679a44', '#355a24'],
  [T_DIRT]: ['#7a6446', '#86704f', '#6a563c', '#9a845f', '#5a4832']
};
function buildTerrain() {
  const m = G.map, RT = R.RT;
  const W = (MAP_W + MAP_H) * HW, H = (MAP_W + MAP_H) * HH + TH;
  const cv = document.createElement('canvas');
  cv.width = W * RT; cv.height = H * RT;
  const ctx = cv.getContext('2d');
  ctx.scale(RT, RT);
  const rng = mulberry32(1234);
  const tileC = (x, y) => [R.ox + (x - y) * HW, (x + y) * HH];
  const inDia = (cx, cy, u, v) => [cx + (u - v) * HW, cy + (u + v) * HH];
  const base = t => t === T_ROCK || t === T_TREE ? T_GRASS : t;
  // 1. 底色
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = m.idx(x, y), t = base(m.terrain[i]), cols = TERRAIN_COLS[t];
    const [cx, cy] = tileC(x, y);
    ctx.fillStyle = cols[m.variant[i] & 1];
    ctx.beginPath(); ctx.moveTo(cx, cy - 0.6); ctx.lineTo(cx + HW + 0.6, cy + HH); ctx.lineTo(cx, cy + TH + 0.6); ctx.lineTo(cx - HW - 0.6, cy + HH); ctx.closePath(); ctx.fill();
  }
  // 2. 鄰格混色(柔化邊界)
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = m.idx(x, y), t = base(m.terrain[i]);
    const [cx, cy] = tileC(x, y);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!m.inb(nx, ny)) continue;
      const nt = base(m.terrain[m.idx(nx, ny)]);
      if (nt === t || nt === T_WATER || t === T_WATER) continue;
      const nc = TERRAIN_COLS[nt];
      for (let k = 0; k < 26; k++) {
        const along = rng(), depth = Math.pow(rng(), 1.8) * 0.45;
        const u = dx === 1 ? 1 - depth : dx === -1 ? depth : along;
        const v = dy === 1 ? 1 - depth : dy === -1 ? depth : along;
        const [px, py] = inDia(cx, cy, u, v);
        ctx.globalAlpha = 0.55 * (1 - depth * 2);
        ell(ctx, px, py, 1.4 + rng() * 1.8, 0.7 + rng() * 0.9, nc[(rng() * 4) | 0]);
      }
      ctx.globalAlpha = 1;
    }
  }
  // 3. 材質細節
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = m.idx(x, y), t = base(m.terrain[i]), cols = TERRAIN_COLS[t];
    const [cx, cy] = tileC(x, y);
    const R2 = () => inDia(cx, cy, rng(), rng());
    if (t === T_GRASS) {
      for (let k = 0; k < 34; k++) {
        const [px, py] = R2();
        const h = 0.8 + rng() * 1.6, lean = (rng() - 0.5) * 0.8;
        line(ctx, [px, py], [px + lean, py - h], cols[2 + ((rng() * 3) | 0)], 0.35);
      }
      if (rng() < 0.25) for (let k = 0; k < 4; k++) { const [px, py] = R2(); circ(ctx, px, py, 0.4, ['#e8e080', '#f0f0f0', '#d070a0'][(rng() * 3) | 0]); }
    } else if (t === T_SAND) {
      for (let k = 0; k < 4; k++) {
        const [px, py] = R2();
        ctx.strokeStyle = cols[rng() < 0.5 ? 3 : 4]; ctx.lineWidth = 0.3; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.ellipse(px, py, 3 + rng() * 3, 0.8, -0.1, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      for (let k = 0; k < 14; k++) { const [px, py] = R2(); pix(ctx, px, py, 0.5, 0.5, cols[2 + ((rng() * 3) | 0)]); }
    } else if (t === T_DIRT) {
      for (let k = 0; k < 8; k++) {
        const [px, py] = R2(), r = 0.4 + rng() * 0.9;
        ell(ctx, px + 0.2, py + 0.2, r, r * 0.6, cols[4]);
        ell(ctx, px, py, r, r * 0.6, '#8d826f');
        ell(ctx, px - r * 0.3, py - r * 0.2, r * 0.4, r * 0.25, '#b0a690');
      }
      for (let k = 0; k < 16; k++) { const [px, py] = R2(); pix(ctx, px, py, 0.5, 0.5, cols[(rng() * 5) | 0]); }
      if (rng() < 0.3) { // 車轍
        const [px, py] = R2();
        ctx.strokeStyle = 'rgba(40,30,20,0.25)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(px - 6, py - 3); ctx.lineTo(px + 6, py + 3); ctx.moveTo(px - 6, py - 1.5); ctx.lineTo(px + 6, py + 4.5); ctx.stroke();
      }
    } else if (t === T_WATER) {
      const g = ctx.createLinearGradient(cx, cy, cx, cy + TH);
      g.addColorStop(0, cols[1]); g.addColorStop(1, cols[2]);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + HW, cy + HH); ctx.lineTo(cx, cy + TH); ctx.lineTo(cx - HW, cy + HH); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const [px, py] = R2();
        ctx.strokeStyle = 'rgba(160,210,255,0.25)'; ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.moveTo(px - 2, py); ctx.quadraticCurveTo(px, py - 0.8, px + 2, py); ctx.stroke();
      }
    }
  }
  // 4. 水岸:沙灘與泡沫
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = m.idx(x, y);
    if (m.terrain[i] !== T_WATER) continue;
    const [cx, cy] = tileC(x, y);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!m.inb(nx, ny) || m.terrain[m.idx(nx, ny)] === T_WATER) continue;
      const edge = (along, depth) => inDia(cx, cy, dx === 1 ? 1 - depth : dx === -1 ? depth : along, dy === 1 ? 1 - depth : dy === -1 ? depth : along);
      // 淺水
      for (let k = 0; k < 18; k++) {
        const [px, py] = edge(rng(), rng() * 0.35);
        ctx.globalAlpha = 0.25; ell(ctx, px, py, 2.5, 1.2, '#4a8ab8'); ctx.globalAlpha = 1;
      }
      // 濕沙
      for (let k = 0; k < 16; k++) {
        const [px, py] = edge(rng(), -0.02 - rng() * 0.12);
        ctx.globalAlpha = 0.6; ell(ctx, px, py, 1.6, 0.8, '#a89868'); ctx.globalAlpha = 1;
      }
      // 泡沫線
      ctx.strokeStyle = 'rgba(230,245,255,0.55)'; ctx.lineWidth = 0.45;
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const [px, py] = edge(k / 8, 0.04 + Math.sin(k * 1.7 + x) * 0.02);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }
  // 5. 大尺度明暗變化
  for (let k = 0; k < 500; k++) {
    const x = rng() * MAP_W, y = rng() * MAP_H;
    const [px, py] = tileC(x, y);
    const r = 20 + rng() * 50;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    const dark = rng() < 0.5;
    g.addColorStop(0, dark ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,220,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, r, r / 2, 0, 0, 6.2832); ctx.fill();
  }
  R.terrain = cv; R.terrainW = W; R.terrainH = H;
  // 小地圖底圖
  const mc = document.createElement('canvas'); mc.width = 240; mc.height = 121;
  mc.getContext('2d').drawImage(cv, 0, 0, 240, 121);
  R.miniTerrain = mc;
  // 地物
  R.doodads = []; R.doodadAt = new Map(); R.stumps = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = m.terrain[m.idx(x, y)];
    if (t === T_TREE || t === T_ROCK) {
      const d = { kind: 'doodad', t, x: x + 0.5, y: y + 0.5, v: m.variant[m.idx(x, y)] };
      R.doodads.push(d); R.doodadAt.set(m.idx(x, y), d);
    }
  }
  R.sprites.clear();
  R.fogCv = document.createElement('canvas'); R.fogCv.width = MAP_W; R.fogCv.height = MAP_H;
  R.fogImg = R.fogCv.getContext('2d').createImageData(MAP_W, MAP_H);
}

function drawTerrain(ctx) {
  const RT = R.RT;
  let sx = (R.camX + R.ox) * RT, sy = R.camY * RT, sw = R.w * RT, sh = R.h * RT;
  let dx = 0, dy = 0;
  if (sx < 0) { dx = -sx / RT; sw += sx; sx = 0; }
  if (sy < 0) { dy = -sy / RT; sh += sy; sy = 0; }
  sw = Math.min(sw, R.terrain.width - sx); sh = Math.min(sh, R.terrain.height - sy);
  if (sw <= 0 || sh <= 0) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(R.terrain, sx, sy, sw, sh, dx, dy, sw / RT, sh / RT);
}

// 平滑戰爭迷霧:64×64 紋理經等角仿射變換後雙線性放大
function drawFog(ctx) {
  const p = me(), img = R.fogImg, d = img.data;
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    d[i * 4 + 3] = p.visible[i] ? 0 : p.explored[i] ? 115 : 255;
  }
  const fc = R.fogCv.getContext('2d');
  fc.putImageData(img, 0, 0);
  ctx.save();
  const r = R.res;
  ctx.setTransform(r * HW, r * HH, -r * HW, r * HH, -r * R.camX, -r * R.camY);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(R.fogCv, 0, 0);
  ctx.restore();
}

// ===== 生命條與選取框 =====
function entTop(e) {
  if (e.kind === 'bld') { const [tx, ty] = P(e.tx + e.w / 2, e.ty, 0); return [tx, e._sprTop !== undefined ? Math.min(ty - 34, e._sprTop - 4) : ty - 34]; }
  const sp = spriteFor(e);
  if (sp) return P(e.x, e.y, sp.h + 2);
  const z = e.def.cat === 'inf' ? 17 : (e.def.look.H || 5) + 13;
  return P(e.x, e.y, z);
}
function drawHealth(ctx, e, sel) {
  let [sx, sy] = entTop(e);
  const wpx = e.kind === 'bld' ? (e.w + e.h) * 6 : e.def.cat === 'inf' ? 11 : 19;
  sx -= wpx / 2;
  const f = clamp(e.hp / e.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(sx - 0.6, sy - 0.6, wpx + 1.2, 3.2);
  const segs = Math.ceil(wpx / 2.2), filled = Math.ceil(segs * f);
  const c = f > 0.5 ? '#3ee05a' : f > 0.25 ? '#f2d228' : '#ec3a22';
  for (let i = 0; i < filled; i++) { pix(ctx, sx + i * 2.2, sy, 1.7, 2, c); pix(ctx, sx + i * 2.2, sy, 1.7, 0.6, 'rgba(255,255,255,0.45)'); }
  if (e.kind === 'unit' && e.def.harvester && sel) {
    const n = Math.ceil(segs * e.cargo / HARV_CAP);
    for (let i = 0; i < n; i++) pix(ctx, sx + i * 2.2, sy + 2.6, 1.7, 0.9, '#f0b840');
  }
  if (sel) {
    ctx.lineWidth = 0.7; ctx.strokeStyle = '#fff';
    if (e.kind === 'bld') {
      const pts = [P(e.tx, e.ty, 0), P(e.tx + e.w, e.ty, 0), P(e.tx + e.w, e.ty + e.h, 0), P(e.tx, e.ty + e.h, 0)];
      // 角落括號
      for (let i = 0; i < 4; i++) {
        const a = pts[i], b = pts[(i + 1) % 4], c2 = pts[(i + 3) % 4];
        ctx.beginPath();
        ctx.moveTo(a[0] + (b[0] - a[0]) * 0.2, a[1] + (b[1] - a[1]) * 0.2); ctx.lineTo(a[0], a[1]);
        ctx.lineTo(a[0] + (c2[0] - a[0]) * 0.2, a[1] + (c2[1] - a[1]) * 0.2); ctx.stroke();
      }
    } else {
      const [cx, cy] = P(e.x, e.y, 0);
      const r = e.def.cat === 'inf' ? 5 : 11;
      ctx.globalAlpha = 0.9;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r / 2, 0, k * Math.PI / 2 + 0.25, (k + 1) * Math.PI / 2 - 0.25); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  if (e.kind === 'bld' && e.repairing) {
    const [cx, cy] = P(e.x, e.y, 32);
    if (Math.sin(G.time * 6) > 0) { glow(ctx, cx, cy, 6, '#40ff40', 0.6); pix(ctx, cx - 3, cy - 1, 6, 2, '#40e040'); pix(ctx, cx - 1, cy - 3, 2, 6, '#40e040'); }
  }
}
function drawRank(ctx, e) {
  let [sx, sy] = entTop(e);
  const x = sx + (e.def.cat === 'inf' ? 7 : 11), y = sy - 1;
  for (let k = 0; k < e.rank; k++) {
    const yy = y + k * 2.4;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x - 1.6, yy + 1.4); ctx.lineTo(x, yy); ctx.lineTo(x + 1.6, yy + 1.4); ctx.stroke();
    ctx.strokeStyle = '#ffd040'; ctx.lineWidth = 0.7; ctx.stroke();
  }
}

// ===== 特效 =====
function drawEffect(ctx, f) {
  const k = f.t / f.dur;
  if (f.t < 0) return;
  switch (f.k) {
    case 'beam': {
      const a = P(f.x1, f.y1, f.z1), b = P(f.x2, f.y2, f.z2);
      ctx.lineCap = 'round';
      ctx.globalAlpha = (1 - k) * 0.25; line(ctx, a, b, f.c, f.w * 2.2 + 3);
      ctx.globalAlpha = (1 - k) * 0.6; line(ctx, a, b, f.c, f.w + 1);
      ctx.globalAlpha = 1 - k; line(ctx, a, b, '#fff4f6', Math.max(0.5, f.w * 0.45));
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
      glow(ctx, b[0], b[1], 4 + f.w * 2, f.c, 0.8 * (1 - k));
      break;
    }
    case 'rail': {
      const a = P(f.x1, f.y1, f.z1), b = P(f.x2, f.y2, f.z2);
      ctx.globalAlpha = (1 - k) * 0.35; line(ctx, a, b, f.c, k < 0.2 ? 4 : 2);
      ctx.globalAlpha = 1 - k; line(ctx, a, b, '#ffffff', k < 0.2 ? 1.2 : 0.4);
      const n = 24, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      ctx.strokeStyle = f.c; ctx.lineWidth = 0.45; ctx.globalAlpha = (1 - k) * 0.8;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const u = i / n, r = Math.sin(u * 30 + k * 10) * (1.5 + k * 3);
        const x = a[0] + dx * u + nx * r, y = a[1] + dy * u + ny * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
    case 'spark': {
      const [x, y] = P(f.x, f.y, f.z);
      const r = 1 + k * 5;
      ctx.globalAlpha = 1 - k;
      glow(ctx, x, y, r * 1.4, f.c, 0.7);
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + f.t * 3; line(ctx, [x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3], [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7], f.c, 0.4); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'glow': {
      const [x, y] = P(f.x, f.y, f.z);
      glow(ctx, x, y, 6, f.c, 0.9 * (1 - k));
      break;
    }
    case 'flash': {
      const [x, y] = P(f.x, f.y, f.z);
      glow(ctx, x, y, 5, '#fff4b0', 0.9); circ(ctx, x, y, 1.2, '#ffffff');
      break;
    }
    case 'expl': {
      const [x, y] = P(f.x, f.y, 0);
      const s = f.size, r = (4 + k * 15) * s, cy = y - r * 0.55;
      ctx.globalAlpha = Math.max(0, 1 - k * 1.1);
      const g = ctx.createRadialGradient(x, cy, 0, x, cy, r);
      g.addColorStop(0, k < 0.25 ? '#ffffff' : '#fff0b0');
      g.addColorStop(0.3, '#ffc040'); g.addColorStop(0.65, k < 0.5 ? '#ff6a10' : '#a03008'); g.addColorStop(1, 'rgba(60,20,5,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, r, 0, 6.2832); ctx.fill();
      if (k > 0.35) { ctx.globalAlpha = (1 - k) * 0.6; ell(ctx, x, cy - r * 0.6, r * 0.8, r * 0.55, '#3a3430'); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'part': {
      const [x, y] = P(f.x, f.y, f.z);
      ctx.globalAlpha = 1 - k;
      if (f.c === '#555') circ(ctx, x, y, 0.8, '#4a4744');
      else { glow(ctx, x, y, 2.2, f.c, 0.8); circ(ctx, x, y, 0.6, '#fff0c0'); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'smoke': {
      const [x, y] = P(f.x, f.y, f.z);
      const r = 2 + k * 7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const c = f.light ? '235,240,245' : '60,58,56';
      g.addColorStop(0, `rgba(${c},${(1 - k) * 0.5})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      break;
    }
    case 'fire': {
      const [x, y] = P(f.x, f.y, f.z);
      ctx.globalAlpha = 1 - k;
      const h = 3 + (1 - k) * 4;
      ctx.fillStyle = vgrad(ctx, y, y - h - k * 6, '#ffe060', 'rgba(255,60,10,0)');
      ctx.beginPath(); ctx.moveTo(x - 1.5, y - k * 6); ctx.quadraticCurveTo(x, y - h * 1.6 - k * 6, x + 1.5, y - k * 6); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'shock': {
      const [x, y] = P(f.x, f.y, 0);
      const r = 10 + k * 90;
      ctx.strokeStyle = '#fff2c0'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = Math.max(0, 0.5 - k);
      ctx.fillRect(0, 0, R.w, R.h);
      ctx.globalAlpha = 1;
      break;
    }
    case 'slash': {
      const [x, y] = P(f.x, f.y, f.z);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8 * (1 - k) + 0.2; pushA(ctx, 1 - k);
      ctx.beginPath(); ctx.arc(x, y, 3 + k * 2, f.a, f.a + 2.2); ctx.stroke();
      popA(ctx);
      break;
    }
    case 'marker': {
      const [x, y] = P(f.x, f.y, 0);
      const r = 10 * (1 - k) + 2;
      ctx.strokeStyle = f.c; ctx.lineWidth = 0.8; ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.5, r / 4, 0, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
  }
}
function drawGroundEffect(ctx, f) {
  const k = f.t / f.dur;
  if (f.k === 'scorch') {
    const [x, y] = P(f.x, f.y, 0);
    const rx = f.r * HW * 1.4, ry = f.r * HH * 1.4;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(20,14,8,${0.65 * (1 - k)})`); g.addColorStop(0.7, `rgba(30,22,14,${0.35 * (1 - k)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); ctx.fill();
  } else if (f.k === 'corpse') {
    const [x, y] = P(f.x, f.y, 0);
    ctx.globalAlpha = 1 - k;
    ell(ctx, x + 0.5, y + 0.3, 3.5, 1.2, 'rgba(0,0,0,0.3)');
    ell(ctx, x - 0.5, y - 0.6, 2.6, 0.9, shade(f.c, 0.55));
    circ(ctx, x + 2.4, y - 0.8, 0.8, '#b08060');
    ell(ctx, x + 1, y + 0.6, 1.8, 0.6, 'rgba(110,10,10,0.5)');
    ctx.globalAlpha = 1;
  } else if (f.k === 'hcorpse') {
    const [x, y] = P(f.x, f.y, 0);
    pushA(ctx, Math.min(1, (1 - k) * 2));
    ell(ctx, x + 0.5, y + 0.3, 7, 2.5, 'rgba(0,0,0,0.3)');
    ell(ctx, x, y - 1.2, 5.5, 2, '#4a3424'); ell(ctx, x + 4, y - 1.6, 1.8, 1, '#4a3424');
    line(ctx, [x - 3, y - 1], [x - 5, y + 0.5], '#3a2a1e', 0.8); line(ctx, [x + 1, y - 0.5], [x + 3, y + 1], '#3a2a1e', 0.8);
    ell(ctx, x - 1, y - 2.2, 2, 0.8, f.c);
    ell(ctx, x - 2.5, y + 1, 2.4, 0.8, 'rgba(110,10,10,0.45)');
    popA(ctx);
  } else if (f.k === 'wreck') {
    ctx.globalAlpha = Math.min(1, (1 - k) * 2);
    const Q = lframe(f.x, f.y, f.dir), r = rect(-f.L / 2, -f.W / 2, f.L / 2, f.W / 2);
    prism(ctx, Q, r, rect(-f.L * 0.42, -f.W * 0.4, f.L * 0.4, f.W * 0.4), 0, 3.5, f.wood ? '#3a2a1c' : '#2c2824', f.wood ? '#4a3624' : '#38332d');
    prism(ctx, Q, rect(-0.15, -0.14, 0.12, 0.14), rect(-0.12, -0.11, 0.1, 0.11), 3.5, 5, '#24201c', '#2e2924');
    line(ctx, Q(0.05, 0, 4.2), Q(0.3, 0.12, 2), '#1a1816', 1);
    if (k < 0.3 && Math.random() < 0.3) G.effects.push({ k: 'fire', x: f.x + (Math.random() - 0.5) * 0.3, y: f.y + (Math.random() - 0.5) * 0.3, z: 4, t: 0, dur: 0.5 });
    ctx.globalAlpha = 1;
    if (Math.random() < 0.1 && k < 0.6) G.effects.push({ k: 'smoke', x: f.x, y: f.y, z: 5, t: 0, dur: 1.4 });
  }
}
function drawProj(ctx, p) {
  if (p.t < 0) return;
  const k = p.t / p.dur;
  const arcH = p.arc ?? (p.k === 'missile' ? 18 : p.k === 'shell' ? 4 : 0);
  const arc = Math.sin(k * Math.PI) * arcH;
  if (p.k === 'arrow' || (p.k === 'shell' && (p.w.ball || p.w.firepot))) {
    const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k, z = p.z0 + (p.z1 - p.z0) * k + arc;
    const [sx, sy] = P(x, y, z);
    if (p.k === 'arrow') {
      const k2 = Math.max(0, k - 0.06), arc2 = Math.sin(k2 * Math.PI) * arcH;
      const [bx, by] = P(p.x0 + (p.x1 - p.x0) * k2, p.y0 + (p.y1 - p.y0) * k2, p.z0 + (p.z1 - p.z0) * k2 + arc2);
      const dx = sx - bx, dy = sy - by, l = Math.hypot(dx, dy) || 1;
      line(ctx, [sx - dx / l * 3.5, sy - dy / l * 3.5], [sx, sy], '#5a4630', 0.4);
      line(ctx, [sx - dx / l * 3.5, sy - dy / l * 3.5], [sx - dx / l * 2.8, sy - dy / l * 2.8], '#e8e2d2', 0.7);
      circ(ctx, sx, sy, 0.3, '#888');
    } else if (p.w.firepot) {
      glow(ctx, sx, sy, 4, '#ff7020', 0.9); circ(ctx, sx, sy, 1.1, '#3a2a1a');
    } else { circ(ctx, sx, sy, 1, '#1a1a1a'); circ(ctx, sx - 0.3, sy - 0.3, 0.3, '#777'); }
    return;
  }
  const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k, z = p.z0 + (p.z1 - p.z0) * k + arc;
  const [sx, sy] = P(x, y, z);
  if (p.k === 'bullet') {
    const k2 = Math.max(0, k - 0.18);
    const [bx, by] = P(p.x0 + (p.x1 - p.x0) * k2, p.y0 + (p.y1 - p.y0) * k2, p.z0 + (p.z1 - p.z0) * k2);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4; line(ctx, [bx, by], [sx, sy], p.c, 1.4);
    ctx.globalAlpha = 1; line(ctx, [bx + (sx - bx) * 0.5, by + (sy - by) * 0.5], [sx, sy], '#fffbe0', 0.5);
    ctx.lineCap = 'butt';
  } else if (p.k === 'shell') {
    glow(ctx, sx, sy, 3, '#ffd060', 0.8); circ(ctx, sx, sy, 0.8, '#fff8d0');
  } else {
    const k2 = Math.max(0, k - 0.03);
    const arc2 = Math.sin(k2 * Math.PI) * arcH;
    const [bx, by] = P(p.x0 + (p.x1 - p.x0) * k2, p.y0 + (p.y1 - p.y0) * k2, p.z0 + (p.z1 - p.z0) * k2 + arc2);
    line(ctx, [bx, by], [sx, sy], p.small ? '#8a6a40' : '#d8d8d0', p.small ? 0.5 : 1.1);
    glow(ctx, bx, by, p.small ? 2 : 3, '#ff9030', 0.9); circ(ctx, bx, by, p.small ? 0.4 : 0.6, '#ffffc0');
  }
}

// ===== 超級武器 =====
function drawStrike(ctx, s) {
  if (s.vis === 'firestorm' || s.vis === 'arrowrain') { drawAncientStrike(ctx, s); return; }
  if (s.k === 'orbital') {
    const [gx, gy] = P(s.cx, s.cy, 0);
    if (s.t < 1) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(s.t * 30);
      line(ctx, [gx, gy], [gx, -10], '#ff8090', 0.6);
      ctx.strokeStyle = '#ff3048'; ctx.lineWidth = 0.8;
      const rr = 50 * (1 - s.t) + 10;
      ctx.beginPath(); ctx.ellipse(gx, gy, rr, rr / 2, 0, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(gx, gy, rr * 0.6, rr * 0.3, 0, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    const fade = Math.min(1, (s.dur - s.t) / 0.5);
    const w = (14 + Math.sin(s.t * 25) * 3) * fade;
    const g = ctx.createLinearGradient(gx - w * 2, 0, gx + w * 2, 0);
    g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(0.3, 'rgba(255,40,70,0.45)'); g.addColorStop(0.45, 'rgba(255,120,140,0.9)');
    g.addColorStop(0.5, 'rgba(255,250,250,1)'); g.addColorStop(0.55, 'rgba(255,120,140,0.9)'); g.addColorStop(0.7, 'rgba(255,40,70,0.45)'); g.addColorStop(1, 'rgba(255,40,70,0)');
    ctx.globalAlpha = fade; ctx.fillStyle = g;
    ctx.fillRect(gx - w * 2, -10, w * 4, gy + 10);
    glow(ctx, gx, gy, w * 4, '#ff4060', 0.8);
    ell(ctx, gx, gy, w * 1.4, w * 0.7, '#fff0f2');
    ctx.globalAlpha = 1;
  } else {
    const [gx, gy] = P(s.x, s.y, 0);
    if (Math.sin(s.t * 14) > 0) {
      ctx.strokeStyle = '#ff3030'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(gx, gy, 3.2 * HW * 1.4, 3.2 * HH * 1.4, 0, 0, 6.2832); ctx.stroke();
      line(ctx, [gx - 10, gy], [gx + 10, gy], '#ff3030', 0.8); line(ctx, [gx, gy - 5], [gx, gy + 5], '#ff3030', 0.8);
    }
    const dragon = s.vis === 'firedragon';
    const missile = (mx, my, up) => {
      if (dragon) {
        ctx.lineCap = 'round'; line(ctx, [mx, my - 6], [mx, my + 3], '#c02a1a', 3); line(ctx, [mx - 0.6, my - 6], [mx - 0.6, my + 3], '#e8b030', 0.6); ctx.lineCap = 'butt';
        const hy = my + (up ? -7 : 4);
        poly(ctx, [[mx - 1.6, hy], [mx + 1.6, hy], [mx, hy + (up ? -3 : 3)]], '#e8b030');
        circ(ctx, mx + 0.6, hy, 0.35, '#111');
        glow(ctx, mx, my + (up ? 4 : -7), 6, '#ff7020', 1);
        return;
      }
      const d = up ? -1 : 1;
      ctx.fillStyle = '#e8e8e4'; ctx.fillRect(mx - 1.2, my - 6, 2.4, 9);
      ctx.fillStyle = '#b8b8b0'; ctx.fillRect(mx + 0.4, my - 6, 0.8, 9);
      poly(ctx, [[mx - 1.2, my + (up ? -6 : 3)], [mx + 1.2, my + (up ? -6 : 3)], [mx, my + (up ? -9 : 6)]], '#c03020');
      glow(ctx, mx, my + (up ? 4 : -7), 5, '#ffb030', 1);
      void d;
    };
    if (s.t < 0.9) {
      const [mx, my] = P(s.sx, s.sy, 8 + s.t * s.t * 500);
      missile(mx, my, true);
      if (Math.random() < 0.8) G.effects.push({ k: 'smoke', x: s.sx, y: s.sy, z: 8 + s.t * s.t * 500, t: 0, dur: 1.5, light: true });
    } else {
      const f = (s.t - 0.9) / (s.dur - 0.9);
      const z = 520 * (1 - f) * (1 - f);
      softShadow(ctx, s.x, s.y, 3 + f * 10, 1.5 + f * 5, 0.5);
      const [mx, my] = P(s.x, s.y, z);
      missile(mx, my, false);
    }
  }
}

function drawAncientStrike(ctx, s) {
  const [gx, gy] = P(s.cx, s.cy, 0);
  if (s.t < 1) {
    pushA(ctx, 0.5 + 0.5 * Math.sin(s.t * 30));
    ctx.strokeStyle = '#ff6020'; ctx.lineWidth = 0.8;
    const rr = 50 * (1 - s.t) + 10;
    ctx.beginPath(); ctx.ellipse(gx, gy, rr, rr / 2, 0, 0, 6.2832); ctx.stroke();
    popA(ctx);
    return;
  }
  const fade = Math.min(1, (s.dur - s.t) / 0.5);
  if (s.vis === 'firestorm') {
    glow(ctx, gx, gy - 6, 50, '#ff5010', 0.55 * fade);
    for (let k = 0; k < 26; k++) {
      const a = hash(k * 31 + 7) * 6.283, r = Math.sqrt(hash(k * 17 + 3)) * 2.6;
      const [fx, fy] = P(s.cx + Math.cos(a) * r, s.cy + Math.sin(a) * r, 0);
      const h = (6 + hash(k) * 10) * (0.7 + 0.3 * Math.sin(G.time * 12 + k)) * fade;
      ctx.fillStyle = vgrad(ctx, fy, fy - h, '#ffe060', 'rgba(255,40,0,0)');
      ctx.beginPath(); ctx.moveTo(fx - 2, fy); ctx.quadraticCurveTo(fx + Math.sin(G.time * 8 + k), fy - h * 1.6, fx + 2, fy); ctx.fill();
    }
    if (Math.random() < 0.5) G.effects.push({ k: 'smoke', x: s.cx + (Math.random() - 0.5) * 4, y: s.cy + (Math.random() - 0.5) * 4, z: 12, t: 0, dur: 2 });
  } else {
    // 神機箭雨
    for (let k = 0; k < 60; k++) {
      const ox = (hash(k * 13 + 1) - 0.5) * 5.5, oy = (hash(k * 7 + 5) - 0.5) * 5.5;
      const ph = (G.time * 1.6 + hash(k * 3)) % 1;
      const z = (1 - ph) * 160;
      const [ax, ay] = P(s.cx + ox - 0.6 * (1 - ph), s.cy + oy - 0.6 * (1 - ph), z);
      const [bx, by] = P(s.cx + ox - 0.6 * (1 - ph) - 0.15, s.cy + oy - 0.6 * (1 - ph) - 0.15, z + 8);
      pushA(ctx, fade);
      line(ctx, [bx, by], [ax, ay], '#6a4a2c', 0.5);
      glow(ctx, bx, by, 2.2, '#ff8020', 0.9);
      popA(ctx);
    }
  }
}

function drawStump(ctx, s) {
  const [x, y] = P(s.x, s.y, 0);
  if (s.wood) {
    ell(ctx, x + 1, y + 0.5, 3.2, 1.4, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = '#5a3c24'; ctx.fillRect(x - 1.6, y - 2.2, 3.2, 2.2);
    ell(ctx, x, y + 0, 1.6, 0.8, '#5a3c24');
    ell(ctx, x, y - 2.2, 1.6, 0.8, '#c8a070'); ell(ctx, x, y - 2.2, 0.8, 0.4, '#a07848');
    for (let k = 0; k < 4; k++) circ(ctx, x + Math.cos(s.v + k * 1.7) * 4, y + Math.sin(s.v + k * 1.7) * 1.6, 0.4, '#7a5a34');
  } else {
    for (let k = 0; k < 6; k++) {
      const a = s.v * 0.7 + k * 1.05, r = 1.5 + (k % 3) * 1.6;
      const px = x + Math.cos(a) * r * 1.5, py = y + Math.sin(a) * r * 0.6;
      ell(ctx, px, py, 1.3, 0.8, k % 2 ? '#7d7870' : '#99948b');
    }
  }
}

// ===== 主渲染 =====
function render() {
  const ctx = R.ctx, m = G.map, p = me();
  ctx.setTransform(R.res, 0, 0, R.res, 0, 0);
  ctx.fillStyle = '#080a0c'; ctx.fillRect(0, 0, R.w, R.h);
  drawTerrain(ctx);
  const corners = [screenToWorld(0, 0), screenToWorld(R.w, 0), screenToWorld(0, R.h), screenToWorld(R.w, R.h)];
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 2), x1 = Math.min(MAP_W - 1, Math.ceil(Math.max(...corners.map(c => c[0]))) + 2);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 2), y1 = Math.min(MAP_H - 1, Math.ceil(Math.max(...corners.map(c => c[1]))) + 2);
  const onScreen = (x, y, pad = 60) => { const [sx, sy] = P(x, y, 0); return sx > -pad && sx < R.w + pad && sy > -pad && sy < R.h + pad * 1.5; };

  // 水面波光
  const wt = G.time;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = m.idx(x, y);
    if (m.terrain[i] !== T_WATER) continue;
    const ph = (m.variant[i] / 40 + wt * 0.8) % 3;
    if (ph < 1) {
      const [sx, sy] = P(x + 0.3 + (m.variant[i] % 7) / 14, y + 0.5, 0);
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.55;
      line(ctx, [sx - 2.5, sy], [sx + 2.5, sy], '#cfe8ff', 0.4);
      ctx.globalAlpha = 1;
    }
  }
  drawOre(ctx, x0, y0, x1, y1);
  for (const s of R.stumps) if (onScreen(s.x, s.y)) drawStump(ctx, s);
  for (const f of G.effects) if (f.k === 'scorch' || f.k === 'corpse' || f.k === 'wreck' || f.k === 'hcorpse') if (onScreen(f.x, f.y)) drawGroundEffect(ctx, f);
  if (UI.placing && UI.hoverTile) drawPlacement(ctx);

  // 深度排序
  const list = [];
  for (const d of R.doodads) if (d.x > x0 - 1 && d.x < x1 + 2 && d.y > y0 - 1 && d.y < y1 + 2 && onScreen(d.x, d.y)) list.push(d);
  for (const e of G.entities) {
    if (!e.alive || !onScreen(e.x, e.y, 120)) continue;
    if (!isVisible(e)) continue;
    list.push(e);
  }
  list.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const e of list) {
    if (e.kind === 'doodad') drawDoodad(ctx, e);
    else if (e.kind === 'bld') drawBuilding(ctx, e);
    else drawUnit(ctx, e);
  }
  for (const pr of G.projs) drawProj(ctx, pr);
  for (const f of G.effects) if (f.k !== 'scorch' && f.k !== 'corpse' && f.k !== 'wreck' && f.k !== 'hcorpse' && f.k !== 'shock' && onScreen(f.x !== undefined ? f.x : f.x1, f.y !== undefined ? f.y : f.y1, 200)) drawEffect(ctx, f);

  for (const e of list) {
    if (e.kind === 'doodad') continue;
    const sel = G.sel.includes(e);
    if (sel || e === UI.hoverEnt || (e.hp < e.maxHp && G.time - e.hitT < 3)) drawHealth(ctx, e, sel);
    if (e.kind === 'unit' && e.rank) drawRank(ctx, e);
  }
  if (p.rally && G.sel.some(e => e.kind === 'bld' && (e.type === 'barracks' || e.type === 'factory'))) {
    const [rx, ry] = P(p.rally[0], p.rally[1], 0);
    line(ctx, [rx, ry], [rx, ry - 13], '#ddd', 0.6);
    const wv = Math.sin(G.time * 5) * 0.8;
    poly(ctx, [[rx, ry - 13], [rx + 7, ry - 11.5 + wv], [rx, ry - 9]], p.color);
  }

  drawFog(ctx);
  for (const s of G.strikes) drawStrike(ctx, s);
  for (const f of G.effects) if (f.k === 'shock') drawEffect(ctx, f);

  if (UI.drag && UI.drag.active) {
    const d = UI.drag;
    ctx.fillStyle = 'rgba(120,255,120,0.08)';
    ctx.fillRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
    ctx.strokeStyle = '#7fff7f'; ctx.lineWidth = 0.6;
    ctx.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
  }
}

function drawPlacement(ctx) {
  const p = me(), type = UI.placing, d = BUILDINGS[type];
  const [hx, hy] = UI.hoverTile;
  const tx = hx - Math.floor((d.w - 1) / 2), ty = hy - Math.floor((d.h - 1) / 2);
  UI.placeAt = [tx, ty];
  const ok = canPlace(p, type, tx, ty);
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
    const good = G.map.terrainOk(x, y) && !G.map.bld[G.map.idx(x, y)] && ok;
    const q = [P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)];
    poly(ctx, q, good ? 'rgba(60,255,60,0.3)' : 'rgba(255,40,40,0.42)');
    polyStroke(ctx, q, good ? 'rgba(140,255,140,0.6)' : 'rgba(255,120,120,0.6)', 0.4);
  }
  ctx.globalAlpha = 0.6;
  drawBuilding(ctx, ghostBuilding(type, p.id, tx, ty));
  ctx.globalAlpha = 1;
}
function ghostBuilding(type, owner, tx, ty) {
  const d = BUILDINGS[type];
  return { id: 0, kind: 'bld', type, owner, tx, ty, w: d.w, h: d.h, x: tx + d.w / 2, y: ty + d.h / 2, prog: 1, hp: 1, maxHp: 1, anim: 0, charge: 0, tdir: Math.PI * 0.75, def: d, ghost: true };
}

// ===== 圖示 =====
function makeIcon(type, owner) {
  const W = 128, H = 96;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#34404a'); g.addColorStop(1, '#12171b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const save = { camX: R.camX, camY: R.camY, zs: R.zs };
  const effLen = G.effects.length;
  const bd = BUILDINGS[type];
  let k, cx, cy, oy;
  if (bd) {
    const s = Math.max(bd.w, bd.h);
    k = s >= 3 ? 1.15 : s === 2 ? 1.55 : 2.4;
    cx = (bd.w / 2 - bd.h / 2) * HW; cy = (bd.w / 2 + bd.h / 2) * HH; oy = 60;
  } else {
    const isInf = UNITS[type].cat === 'inf';
    k = isInf ? 4.2 : 2.6;
    cx = 0; cy = HH; oy = isInf ? 82 : 64;
  }
  R.camX = cx - (W / 2) / k; R.camY = cy - oy / k;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (bd) drawBuilding(ctx, ghostBuilding(type, owner, 0, 0));
  else {
    const u = { kind: 'unit', def: UNITS[type], type, owner, x: 0.5, y: 0.5, dir: Math.PI * 0.75, tdir: Math.PI * 0.75, moving: false, anim: 0, cool: 0, cargo: 300, hstate: '', weapon: UNITS[type].weapon ? WEAPONS[UNITS[type].weapon] : null, id: 7 };
    drawUnit(ctx, u);
  }
  G.effects.length = effLen;
  R.camX = save.camX; R.camY = save.camY; R.zs = save.zs;
  return cv;
}
