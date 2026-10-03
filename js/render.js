'use strict';
// ===== 等角像素渲染 =====
const R = { camX: 0, camY: 0, ctx: null, cv: null, w: 0, h: 0, zs: 1, terrain: null, ox: MAP_H * HW };

function P(x, y, z = 0) {
  return [Math.round((x - y) * HW - R.camX), Math.round((x + y) * HH - R.camY - z * R.zs)];
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
  R.camX = clamp(R.camX, -MAP_H * HW - m, MAP_W * HW - R.w + m);
  R.camY = clamp(R.camY, -m, (MAP_W + MAP_H) * HH - R.h + m + 40);
}

function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}
function line(ctx, a, b, col, w = 1) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

// 軸對齊的等角方塊
function isoBox(ctx, x0, y0, x1, y1, z0, z1, col, topCol) {
  poly(ctx, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], shade(col, 0.78));
  poly(ctx, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], shade(col, 0.58));
  poly(ctx, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], topCol || col);
}
// 圓柱
function isoCyl(ctx, cx, cy, r, z0, z1, col, topCol) {
  const rx = r * HW * 1.414, ry = r * HH * 1.414;
  const [bx, by] = P(cx, cy, z0), [tx, ty] = P(cx, cy, z1);
  ctx.fillStyle = shade(col, 0.6);
  ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI); ctx.fill();
  ctx.fillRect(bx - rx, ty, rx * 2, by - ty);
  ctx.fillStyle = shade(col, 0.8);
  ctx.fillRect(bx - rx, ty, rx, by - ty);
  ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, Math.PI / 2, Math.PI); ctx.fill();
  ctx.fillStyle = topCol || col;
  ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
// 旋轉方塊(載具車身)
function rotBox(ctx, cx, cy, ang, L, W, z0, z1, col, topCol) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const loc = [[L / 2, W / 2], [L / 2, -W / 2], [-L / 2, -W / 2], [-L / 2, W / 2]];
  const pts = loc.map(([lx, ly]) => [cx + lx * c - ly * s, cy + lx * s + ly * c]);
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
    if (mx + my <= 0) continue; // 背面
    const l = Math.hypot(mx, my) || 1;
    faces.push({ a, b, f: 0.62 + 0.16 * (my - mx) / l, d: mx + my });
  }
  faces.sort((p, q) => p.d - q.d);
  for (const fc of faces)
    poly(ctx, [P(fc.a[0], fc.a[1], z0), P(fc.b[0], fc.b[1], z0), P(fc.b[0], fc.b[1], z1), P(fc.a[0], fc.a[1], z1)], shade(col, fc.f));
  poly(ctx, pts.map(p => P(p[0], p[1], z1)), topCol || col);
  return pts;
}
function shadow(ctx, x, y, rx, ry) {
  const [sx, sy] = P(x, y, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(sx + 1, sy + 1, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function pix(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

// ===== 地形預渲染 =====
const TERRAIN_COLS = {
  [T_GRASS]: ['#4f7a35', '#5a8a3c', '#46702f', '#6a9a46'],
  [T_SAND]: ['#b8a46a', '#c7b47a', '#a8945c', '#d2c08a'],
  [T_WATER]: ['#1f4f7a', '#245a88', '#1b466d', '#3a77a8'],
  [T_ROCK]: ['#6b665e', '#77726a', '#5d5850', '#86817a'],
  [T_TREE]: ['#3f6a2b', '#4a7833', '#36602a', '#5a8a3c'],
  [T_DIRT]: ['#7a6446', '#86704f', '#6c583d', '#957f5c']
};
function buildTerrain() {
  const m = G.map;
  const cv = document.createElement('canvas');
  cv.width = (MAP_W + MAP_H) * HW; cv.height = (MAP_W + MAP_H) * HH + TH;
  const ctx = cv.getContext('2d');
  const rng = mulberry32(1234);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = m.idx(x, y), t = m.terrain[i], cols = TERRAIN_COLS[t];
    const cx = R.ox + (x - y) * HW, cy = (x + y) * HH;
    const base = t === T_ROCK || t === T_TREE ? TERRAIN_COLS[T_GRASS] : cols;
    ctx.fillStyle = base[m.variant[i] & 1];
    ctx.beginPath(); ctx.moveTo(cx, cy - 0.5); ctx.lineTo(cx + HW + 0.5, cy + HH); ctx.lineTo(cx, cy + TH + 0.5); ctx.lineTo(cx - HW - 0.5, cy + HH); ctx.closePath(); ctx.fill();
    // 像素雜點
    const n = t === T_WATER ? 6 : 14;
    for (let k = 0; k < n; k++) {
      const u = rng(), v = rng();
      const px = cx + (u - v) * HW, py = cy + (u + v) * HH;
      ctx.fillStyle = base[2 + (rng() < 0.5 ? 0 : 1)];
      ctx.fillRect(Math.round(px), Math.round(py), t === T_WATER ? 3 : 1, 1);
    }
    // 水岸泡沫
    if (t === T_WATER) {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (m.inb(nx, ny) && m.terrain[m.idx(nx, ny)] !== T_WATER) {
          ctx.fillStyle = 'rgba(200,230,255,0.35)';
          for (let k = 0; k < 6; k++) {
            const u = dx === 0 ? rng() : (dx > 0 ? 0.92 : 0.05), v = dy === 0 ? rng() : (dy > 0 ? 0.92 : 0.05);
            ctx.fillRect(Math.round(cx + (u - v) * HW), Math.round(cy + (u + v) * HH), 2, 1);
          }
        }
      }
    }
  }
  R.terrain = cv;
  // 地物(樹、岩石)
  R.doodads = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = m.terrain[m.idx(x, y)];
    if (t === T_TREE || t === T_ROCK) R.doodads.push({ kind: 'doodad', t, x: x + 0.5, y: y + 0.5, v: m.variant[m.idx(x, y)] });
  }
}

function drawDoodad(ctx, d) {
  const [sx, sy] = P(d.x, d.y, 0);
  if (d.t === T_TREE) {
    const h = 10 + (d.v % 6), ox = (d.v >> 3) % 5 - 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx + 3, sy + 1, 8, 3, 0, 0, 7); ctx.fill();
    pix(ctx, sx + ox - 1, sy - 5, 2, 6, '#4a3020');
    const greens = ['#2f5a24', '#3b6e2c', '#4b8236', '#5c9640'];
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = greens[k];
      const r = 7 - k * 1.4;
      ctx.beginPath(); ctx.arc(sx + ox - k * 0.6, sy - h + 2 - k * 2.4, r, 0, 7); ctx.fill();
    }
    pix(ctx, sx + ox - 3, sy - h - 5, 2, 1, '#7ab055');
  } else {
    const s = 0.7 + (d.v % 4) * 0.1;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx + 2, sy + 1, 14 * s, 5 * s, 0, 0, 7); ctx.fill();
    poly(ctx, [[sx - 13 * s, sy], [sx - 8 * s, sy - 10 * s], [sx + 1, sy - 15 * s], [sx + 10 * s, sy - 8 * s], [sx + 13 * s, sy + 1], [sx, sy + 5 * s]], '#6f6a62');
    poly(ctx, [[sx - 8 * s, sy - 10 * s], [sx + 1, sy - 15 * s], [sx + 10 * s, sy - 8 * s], [sx + 1, sy - 5 * s]], '#8c877e');
    poly(ctx, [[sx + 1, sy - 5 * s], [sx + 10 * s, sy - 8 * s], [sx + 13 * s, sy + 1], [sx, sy + 5 * s]], '#56524b');
  }
}

// ===== 礦物 =====
function drawOre(ctx, x0, y0, x1, y1) {
  const m = G.map, p = me();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    if (!m.oreType[i] || m.ore[i] < 15 || !p.explored[i]) continue;
    const [cx, cy] = P(x + 0.5, y + 0.5, 0);
    const v = m.variant[i], amt = m.ore[i] / 800;
    const gem = m.oreType[i] === 2;
    const n = 2 + Math.floor(amt * 5);
    for (let k = 0; k < n; k++) {
      const a = (v * 7 + k * 53) % 100 / 100, b = (v * 13 + k * 29) % 100 / 100;
      const px = cx + (a - b) * HW * 0.8, py = cy + (a + b - 1) * HH * 0.8;
      const h = 2 + ((v + k * 3) % 4);
      const c1 = gem ? '#5fd0ff' : '#e0a83a', c2 = gem ? '#b6f0ff' : '#ffd77a', c3 = gem ? '#2a6ea0' : '#8a5a1a';
      pix(ctx, px - 1, py - h, 2, h, c1);
      pix(ctx, px - 1, py - h, 1, 1, c2);
      pix(ctx, px + 1, py - h + 1, 1, h - 1, c3);
    }
  }
}

// ===== 單位 =====
function drawUnit(ctx, u) {
  const d = u.def, lk = d.look, col = G.players[u.owner].color;
  if (lk.kind === 'inf') { drawInf(ctx, u, col); return; }
  const bob = u.moving ? Math.sin(u.anim * 3) * 0.3 : 0;
  shadow(ctx, u.x, u.y, lk.L * 14, lk.L * 7);
  if (lk.kind === 'harv') {
    // 履帶
    rotBox(ctx, u.x, u.y, u.dir, lk.L, lk.W, 0, 3, '#3a3a3a');
    rotBox(ctx, u.x, u.y, u.dir, lk.L * 0.92, lk.W * 0.85, 3, lk.H, '#c8a030', '#d8b040');
    // 駕駛艙
    const c = Math.cos(u.dir), s = Math.sin(u.dir);
    rotBox(ctx, u.x + c * lk.L * 0.3, u.y + s * lk.L * 0.3, u.dir, lk.L * 0.3, lk.W * 0.7, lk.H, lk.H + 4, col);
    // 礦斗
    const fill = u.cargo / HARV_CAP;
    rotBox(ctx, u.x - c * lk.L * 0.15, u.y - s * lk.L * 0.15, u.dir, lk.L * 0.5, lk.W * 0.75, lk.H, lk.H + 2, '#5a5a5a', fill > 0.05 ? (fill > 0.6 ? '#e8b040' : '#a88038') : '#3a3a3a');
    if (u.hstate === 'harvest' && Math.sin(u.anim * 4) > 0) {
      const [fx, fy] = P(u.x + c * lk.L * 0.55, u.y + s * lk.L * 0.55, 2);
      pix(ctx, fx - 1, fy - 1, 2, 2, '#ffd77a');
    }
    return;
  }
  const z0 = 1 + bob;
  // 履帶/輪子
  rotBox(ctx, u.x, u.y, u.dir, lk.L, lk.W, z0 - 1, z0 + 2, lk.wheels ? '#2c2c2c' : '#3b3b36');
  rotBox(ctx, u.x, u.y, u.dir, lk.L * 0.9, lk.W * 0.8, z0 + 2, z0 + lk.H, col, shade(col, 1.12));
  // 砲塔
  const tz = z0 + lk.H, tc = Math.cos(u.tdir), ts = Math.sin(u.tdir);
  const tx = u.x, ty = u.y;
  const recoil = u.cool > (u.weapon ? u.weapon.rof - 0.15 : 0) ? -0.06 : 0;
  switch (lk.tur) {
    case 'mg':
      rotBox(ctx, tx, ty, u.tdir, 0.25, 0.22, tz, tz + 3, '#555');
      line(ctx, P(tx, ty, tz + 2), P(tx + tc * 0.4, ty + ts * 0.4, tz + 2), '#222', 1);
      break;
    case 'laser': {
      rotBox(ctx, tx - tc * 0.05, ty - ts * 0.05, u.tdir, 0.42, 0.34, tz, tz + 4, shade(col, 0.85), shade(col, 1.05));
      line(ctx, P(tx, ty, tz + 2), P(tx + tc * (0.55 + recoil), ty + ts * (0.55 + recoil), tz + 2), '#3a3a3a', 2);
      const [ex, ey] = P(tx + tc * 0.55, ty + ts * 0.55, tz + 2);
      pix(ctx, ex - 1, ey - 1, 2, 2, (G.time * 4 + u.id) % 2 < 1 ? '#ff6a7a' : '#ff3048');
      break;
    }
    case 'lance': {
      rotBox(ctx, tx - tc * 0.15, ty - ts * 0.15, u.tdir, 0.4, 0.4, tz, tz + 3, '#666');
      const [ex, ey] = P(tx + tc * 0.1, ty + ts * 0.1, tz + 8);
      line(ctx, P(tx - tc * 0.1, ty - ts * 0.1, tz + 3), [ex, ey], '#444', 2);
      ctx.fillStyle = '#9aa'; ctx.beginPath(); ctx.ellipse(ex, ey, 5, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff4060'; ctx.beginPath(); ctx.ellipse(ex, ey, 2, 1.3, 0, 0, 7); ctx.fill();
      break;
    }
    case 'cannon':
      rotBox(ctx, tx - tc * 0.08, ty - ts * 0.08, u.tdir, 0.5, 0.45, tz, tz + 4, shade(col, 0.8), shade(col, 1.0));
      line(ctx, P(tx + tc * 0.15, ty + ts * 0.15, tz + 2), P(tx + tc * (0.75 + recoil), ty + ts * (0.75 + recoil), tz + 2), '#262626', 2);
      break;
    case 'rail': {
      rotBox(ctx, tx - tc * 0.1, ty - ts * 0.1, u.tdir, 0.35, 0.36, tz, tz + 3, '#555');
      const px = -ts * 0.07, py = tc * 0.07;
      for (const k of [-1, 1]) line(ctx, P(tx + px * k, ty + py * k, tz + 3), P(tx + tc * 0.85 + px * k, ty + ts * 0.85 + py * k, tz + 3), '#8aa', 1);
      const [ex, ey] = P(tx + tc * 0.4, ty + ts * 0.4, tz + 3);
      pix(ctx, ex - 1, ey - 1, 2, 2, '#9fe3ff');
      break;
    }
  }
}

function drawInf(ctx, u, col) {
  const [sx, sy] = P(u.x, u.y, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx - 3, sy - 1, 6, 2);
  const step = u.moving ? Math.sin(u.anim * 2) : 0;
  const fx = Math.cos(u.dir) - Math.sin(u.dir), fy = (Math.cos(u.dir) + Math.sin(u.dir)) / 2;
  const fl = Math.hypot(fx, fy) || 1, dx = fx / fl, dy = fy / fl;
  // 腿
  pix(ctx, sx - 2, sy - 4, 1, 4 - (step > 0 ? 1 : 0), '#2a2a2a');
  pix(ctx, sx + 1, sy - 4, 1, 4 - (step < 0 ? 1 : 0), '#2a2a2a');
  // 身體
  pix(ctx, sx - 2, sy - 9, 4, 5, col);
  pix(ctx, sx - 2, sy - 9, 1, 5, shade(col, 1.25));
  pix(ctx, sx + 1, sy - 9, 1, 5, shade(col, 0.7));
  // 頭
  pix(ctx, sx - 1, sy - 11, 3, 2, '#e3b98f');
  pix(ctx, sx - 1, sy - 12, 3, 1, shade(col, 0.6));
  if (u.def.look.gun === 'none') {
    // 工程師:黃色安全帽與工具包
    pix(ctx, sx - 2, sy - 13, 4, 2, '#f0c020');
    pix(ctx, sx + dx * 2 - 1, sy - 6 + dy * 2, 3, 2, '#8a6a30');
    return;
  }
  // 武器
  const gl = u.def.look.gun === 'rocket' ? 6 : 5;
  const gx = sx + dx * 1.5, gy = sy - 7 + dy * 1.5;
  line(ctx, [gx, gy], [gx + dx * gl, gy + dy * gl], u.def.look.gun === 'rocket' ? '#5a6040' : '#222', u.def.look.gun === 'rocket' ? 2 : 1);
  if (u.def.look.gun === 'laser') pix(ctx, gx + dx * gl - 0.5, gy + dy * gl - 0.5, 1, 1, '#ff4060');
  if (u.weapon && u.cool > u.weapon.rof - 0.08) pix(ctx, gx + dx * (gl + 1) - 1, gy + dy * (gl + 1) - 1, 2, 2, '#fff2a0');
}

// ===== 建築 =====
function drawBuilding(ctx, b) {
  const col = G.players[b.owner].color;
  const x0 = b.tx, y0 = b.ty, x1 = b.tx + b.w, y1 = b.ty + b.h;
  R.zs = b.prog < 1 ? b.prog : 1;
  const conc = '#8e939a', dark = '#5c6168', t = G.time + b.anim;
  const damaged = b.hp / b.maxHp < 0.5;
  // 地基
  isoBox(ctx, x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05, 0, 2, '#6e7278', '#7d8288');
  switch (b.type) {
    case 'conyard': {
      isoBox(ctx, x0 + 0.3, y0 + 0.3, x1 - 0.9, y1 - 0.9, 2, 18, conc, '#a3a8af');
      isoBox(ctx, x0 + 0.28, y0 + 0.28, x1 - 0.88, y1 - 0.88, 12, 15, col);
      isoBox(ctx, x0 + 0.6, y0 + 0.6, x0 + 1.5, y0 + 1.5, 18, 24, '#9aa0a8', '#b5bbc2');
      // 起重機
      isoBox(ctx, x1 - 0.55, y0 + 0.35, x1 - 0.35, y0 + 0.55, 2, 38, '#d0a020', '#e8c040');
      const ang = Math.sin(t * 0.3) * 0.8 + 2.4;
      line(ctx, P(x1 - 0.45, y0 + 0.45, 38), P(x1 - 0.45 + Math.cos(ang) * 1.8, y0 + 0.45 + Math.sin(ang) * 1.8, 38), '#e8c040', 2);
      // 停機坪
      poly(ctx, [P(x1 - 0.85, y1 - 0.85, 2), P(x1 - 0.1, y1 - 0.85, 2), P(x1 - 0.1, y1 - 0.1, 2), P(x1 - 0.85, y1 - 0.1, 2)], '#505458');
      const [hx, hy] = P(x1 - 0.47, y1 - 0.47, 2);
      pix(ctx, hx - 3, hy - 1, 6, 1, '#e8e8e8'); pix(ctx, hx - 3, hy - 3, 1, 5, '#e8e8e8'); pix(ctx, hx + 2, hy - 3, 1, 5, '#e8e8e8');
      // 天線燈
      if (Math.sin(t * 4) > 0) { const [lx, ly] = P(x1 - 0.45, y0 + 0.45, 39); pix(ctx, lx - 1, ly - 1, 2, 2, '#ff3030'); }
      break;
    }
    case 'power': {
      isoBox(ctx, x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, 2, 8, conc, '#a3a8af');
      isoBox(ctx, x0 + 0.18, y0 + 0.18, x1 - 0.18, y1 - 0.18, 5, 7, col);
      isoCyl(ctx, b.x, b.y, 0.55, 8, 16, '#b0b5bc', '#c8cdd4');
      const glow = 0.6 + 0.4 * Math.sin(t * 3);
      const [gx, gy] = P(b.x, b.y, 16);
      ctx.fillStyle = `rgba(90,230,255,${0.5 + 0.4 * glow})`;
      ctx.beginPath(); ctx.ellipse(gx, gy, 9, 4.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.ellipse(gx, gy, 4, 2, 0, 0, 7); ctx.fill();
      isoCyl(ctx, x0 + 0.4, y1 - 0.4, 0.15, 8, 20, '#777');
      if (!G.players[b.owner].lowPower && Math.random() < 0.05) G.effects.push({ k: 'smoke', x: x0 + 0.4, y: y1 - 0.4, z: 20, t: 0, dur: 1.2, light: true });
      break;
    }
    case 'refinery': {
      isoBox(ctx, x0 + 0.2, y0 + 0.2, x1 - 1.1, y1 - 0.3, 2, 16, conc, '#a3a8af');
      isoBox(ctx, x0 + 0.18, y0 + 0.18, x1 - 1.08, y1 - 0.28, 10, 13, col);
      isoCyl(ctx, x1 - 0.55, y0 + 0.6, 0.35, 2, 22, '#a8adb4', shade(col, 1.1));
      isoCyl(ctx, x1 - 0.55, y0 + 1.5, 0.35, 2, 22, '#a8adb4', shade(col, 1.1));
      // 卸載口
      isoBox(ctx, x1 - 0.5, y0 + 1.1, x1 + 0.05, y0 + 1.9, 2, 5, '#4a4e54');
      isoBox(ctx, x0 + 0.5, y0 + 0.5, x0 + 1.0, y0 + 1.0, 16, 26, '#777c83');
      if (Math.random() < 0.06) G.effects.push({ k: 'smoke', x: x0 + 0.75, y: y0 + 0.75, z: 26, t: 0, dur: 1.5 });
      break;
    }
    case 'barracks': {
      isoBox(ctx, x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, 2, 12, '#7d8a6a', '#8e9c7a');
      isoBox(ctx, x0 + 0.18, y0 + 0.18, x1 - 0.18, y1 - 0.18, 9, 11, col);
      // 門
      poly(ctx, [P(x0 + 0.7, y1 - 0.2, 2), P(x0 + 1.3, y1 - 0.2, 2), P(x0 + 1.3, y1 - 0.2, 8), P(x0 + 0.7, y1 - 0.2, 8)], '#2a2d30');
      // 旗
      line(ctx, P(x0 + 0.4, y0 + 0.4, 12), P(x0 + 0.4, y0 + 0.4, 28), '#ccc', 1);
      const [fx, fy] = P(x0 + 0.4, y0 + 0.4, 28);
      const wv = Math.sin(t * 5) > 0 ? 1 : 0;
      pix(ctx, fx + 1, fy + wv, 8, 5, col); pix(ctx, fx + 1, fy + wv, 8, 1, shade(col, 1.3));
      break;
    }
    case 'factory': {
      isoBox(ctx, x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, 2, 20, conc, '#a3a8af');
      isoBox(ctx, x0 + 0.18, y0 + 0.18, x1 - 0.18, y1 - 0.18, 16, 19, col);
      // 車庫門
      poly(ctx, [P(x0 + 0.8, y1 - 0.2, 2), P(x1 - 0.8, y1 - 0.2, 2), P(x1 - 0.8, y1 - 0.2, 13), P(x0 + 0.8, y1 - 0.2, 13)], '#33373b');
      for (let k = 0; k < 4; k++) line(ctx, P(x0 + 0.8, y1 - 0.2, 4 + k * 2.5), P(x1 - 0.8, y1 - 0.2, 4 + k * 2.5), '#4a4f55', 1);
      isoBox(ctx, x0 + 0.5, y0 + 0.5, x0 + 1.2, y0 + 1.2, 20, 25, '#6a6f75');
      isoBox(ctx, x0 + 1.6, y0 + 0.5, x0 + 2.3, y0 + 1.2, 20, 25, '#6a6f75');
      break;
    }
    case 'tech': {
      isoBox(ctx, x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, 2, 14, '#c8ccd2', '#dde1e6');
      isoBox(ctx, x0 + 0.18, y0 + 0.18, x1 - 0.18, y1 - 0.18, 4, 6, col);
      // 碟形天線
      const a = t * 0.8;
      line(ctx, P(b.x, b.y, 14), P(b.x, b.y, 22), '#777', 2);
      const [dx, dy] = P(b.x, b.y, 24);
      ctx.fillStyle = '#e8ecf0'; ctx.beginPath(); ctx.ellipse(dx, dy, 9 * Math.abs(Math.cos(a)) + 2, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#9aa'; ctx.beginPath(); ctx.ellipse(dx, dy, 3 * Math.abs(Math.cos(a)) + 1, 2, 0, 0, 7); ctx.fill();
      if (Math.sin(t * 6) > 0.3) { const [lx, ly] = P(x1 - 0.4, y0 + 0.4, 18); pix(ctx, lx, ly, 2, 2, '#40ff80'); }
      line(ctx, P(x1 - 0.4, y0 + 0.4, 14), P(x1 - 0.4, y0 + 0.4, 18), '#888', 1);
      break;
    }
    case 'ac_super': {
      isoBox(ctx, x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, 2, 8, '#4a5058', '#5c636c');
      isoBox(ctx, x0 + 0.13, y0 + 0.13, x1 - 0.13, y1 - 0.13, 5, 7, col);
      // 相位陣列天線
      const ready = b.charge >= b.def.charge;
      const tilt = 6 + Math.sin(t * 0.5) * 1;
      poly(ctx, [P(x0 + 0.4, y0 + 0.4, 8 + tilt * 2), P(x1 - 0.4, y0 + 0.4, 8 + tilt * 2), P(x1 - 0.3, y1 - 0.3, 10), P(x0 + 0.3, y1 - 0.3, 10)], '#2a3a55');
      for (let k = 1; k < 4; k++) {
        const f = k / 4;
        line(ctx, P(x0 + 0.4 + f * (x1 - x0 - 0.8), y0 + 0.4, 8 + tilt * 2), P(x0 + 0.3 + f * (x1 - x0 - 0.6), y1 - 0.3, 10), '#5a7aa8', 1);
      }
      line(ctx, P(b.x, b.y, 10), P(b.x, b.y, 34), '#999', 2);
      const [lx, ly] = P(b.x, b.y, 35);
      const pulse = ready ? (Math.sin(t * 8) > 0 ? '#ff3048' : '#ff9aa8') : shade('#ff3048', 0.4 + 0.6 * (b.charge / b.def.charge));
      pix(ctx, lx - 2, ly - 2, 4, 4, pulse);
      if (ready) { ctx.fillStyle = 'rgba(255,48,72,0.3)'; ctx.beginPath(); ctx.arc(lx, ly, 7, 0, 7); ctx.fill(); }
      break;
    }
    case 'ep_super': {
      isoBox(ctx, x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, 2, 6, '#4a5058', '#5c636c');
      isoBox(ctx, x0 + 0.13, y0 + 0.13, x1 - 0.13, y1 - 0.13, 3, 5, col);
      // 導彈井蓋
      const ready = b.charge >= b.def.charge;
      const open = ready ? 0.35 : 0;
      poly(ctx, [P(x0 + 0.4, y0 + 0.4, 6), P(x1 - 0.4, y0 + 0.4, 6), P(x1 - 0.4, y1 - 0.4, 6), P(x0 + 0.4, y1 - 0.4, 6)], '#1a1c1e');
      isoBox(ctx, x0 + 0.4 - open, y0 + 0.4, b.x - open, y1 - 0.4, 6, 8, '#6a7078');
      isoBox(ctx, b.x + open, y0 + 0.4, x1 - 0.4 + open, y1 - 0.4, 6, 8, '#6a7078');
      if (ready) {
        isoCyl(ctx, b.x, b.y, 0.12, 6, 22, '#d8dde2', '#ff4030');
      }
      const [hx, hy] = P(x0 + 0.25, y1 - 0.25, 6);
      pix(ctx, hx - 2, hy - 1, 5, 2, ready && Math.sin(t * 8) > 0 ? '#ff3030' : '#f0c020');
      break;
    }
    case 'ac_turret': case 'ep_turret': {
      isoBox(ctx, x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, 2, 9, dark, '#787d84');
      isoBox(ctx, x0 + 0.13, y0 + 0.13, x1 - 0.13, y1 - 0.13, 6, 8, col);
      const c = Math.cos(b.tdir), s = Math.sin(b.tdir);
      if (b.type === 'ac_turret') {
        isoCyl(ctx, b.x, b.y, 0.22, 9, 14, '#9aa0a8', '#b8bec6');
        line(ctx, P(b.x, b.y, 14), P(b.x + c * 0.5, b.y + s * 0.5, 15), '#444', 3);
        const [ex, ey] = P(b.x + c * 0.5, b.y + s * 0.5, 15);
        const on = !G.players[b.owner].lowPower;
        pix(ctx, ex - 1, ey - 1, 3, 3, on ? '#ff3048' : '#552030');
        if (on) { ctx.fillStyle = 'rgba(255,60,80,0.25)'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, 7); ctx.fill(); }
      } else {
        rotBox(ctx, b.x, b.y, b.tdir, 0.45, 0.4, 9, 14, '#6f757c', '#8a9097');
        const px = -s * 0.08, py = c * 0.08;
        for (const k of [-1, 1]) line(ctx, P(b.x + px * k, b.y + py * k, 13), P(b.x + c * 0.7 + px * k, b.y + s * 0.7 + py * k, 13), '#9ab', 1);
        const [ex, ey] = P(b.x + c * 0.15, b.y + s * 0.15, 14);
        pix(ctx, ex - 1, ey - 1, 2, 2, G.players[b.owner].lowPower ? '#345' : '#9fe3ff');
      }
      break;
    }
  }
  R.zs = 1;
  if (damaged && b.prog >= 1 && Math.random() < 0.15) {
    G.effects.push({ k: 'smoke', x: b.tx + Math.random() * b.w, y: b.ty + Math.random() * b.h, z: 12, t: 0, dur: 1.4 });
    if (Math.random() < 0.3) G.effects.push({ k: 'fire', x: b.tx + Math.random() * b.w, y: b.ty + Math.random() * b.h, z: 8, t: 0, dur: 0.5 });
  }
}

// ===== 生命條與選取框 =====
function drawHealth(ctx, e, sel) {
  let sx, sy, wpx;
  if (e.kind === 'bld') {
    [sx, sy] = P(e.tx, e.ty, 0); sy -= 30; wpx = (e.w + e.h) * 6;
    sx -= wpx / 2 - (e.w - e.h) * HW / 2;
    const [tx, ty] = P(e.tx + e.w / 2, e.ty, 0);
    sx = tx - wpx / 2; sy = ty - 30;
  } else {
    const z = e.def.cat === 'inf' ? 15 : (e.def.look.H || 5) + 12;
    [sx, sy] = P(e.x, e.y, z); wpx = e.def.cat === 'inf' ? 10 : 18; sx -= wpx / 2;
  }
  const f = e.hp / e.maxHp;
  ctx.fillStyle = '#000'; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, wpx + 2, 4);
  ctx.fillStyle = f > 0.5 ? '#3cdc3c' : f > 0.25 ? '#f0d020' : '#e83020';
  const segs = Math.ceil(wpx / 3), filled = Math.ceil(segs * f);
  for (let i = 0; i < filled; i++) ctx.fillRect(Math.round(sx) + i * 3, Math.round(sy), 2, 2);
  if (e.kind === 'unit' && e.def.harvester && sel) {
    ctx.fillStyle = '#e8b040';
    const c = Math.ceil(segs * e.cargo / HARV_CAP);
    for (let i = 0; i < c; i++) ctx.fillRect(Math.round(sx) + i * 3, Math.round(sy) + 3, 2, 1);
  }
  if (sel) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    if (e.kind === 'bld') {
      const pts = [P(e.tx, e.ty, 0), P(e.tx + e.w, e.ty, 0), P(e.tx + e.w, e.ty + e.h, 0), P(e.tx, e.ty + e.h, 0)];
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] + 0.5, p[1] + 0.5) : ctx.moveTo(p[0] + 0.5, p[1] + 0.5)); ctx.closePath(); ctx.stroke();
    } else {
      const [cx, cy] = P(e.x, e.y, 0);
      const r = e.def.cat === 'inf' ? 5 : 11;
      ctx.beginPath(); ctx.ellipse(cx + 0.5, cy + 0.5, r, r / 2, 0, 0, 7); ctx.stroke();
    }
  }
  if (e.kind === 'bld' && e.repairing) {
    const [cx, cy] = P(e.x, e.y, 30);
    if (Math.sin(G.time * 6) > 0) { pix(ctx, cx - 3, cy - 1, 7, 3, '#40e040'); pix(ctx, cx - 1, cy - 3, 3, 7, '#40e040'); }
  }
}

// ===== 特效 =====
function drawEffect(ctx, f) {
  const k = f.t / f.dur;
  if (f.t < 0) return;
  switch (f.k) {
    case 'beam': {
      const a = P(f.x1, f.y1, f.z1), b = P(f.x2, f.y2, f.z2);
      ctx.globalAlpha = (1 - k) * 0.35;
      line(ctx, a, b, f.c, f.w + 5);
      ctx.globalAlpha = 1 - k;
      line(ctx, a, b, f.c, f.w + 2);
      ctx.globalAlpha = (1 - k) * 0.9;
      line(ctx, a, b, '#ffe8ec', Math.max(1, f.w - 1));
      ctx.globalAlpha = 1;
      break;
    }
    case 'rail': {
      const a = P(f.x1, f.y1, f.z1), b = P(f.x2, f.y2, f.z2);
      ctx.globalAlpha = 1 - k;
      line(ctx, a, b, f.c, k < 0.2 ? 3 : 1);
      ctx.globalAlpha = (1 - k) * 0.5;
      // 螺旋殘影
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u + Math.sin(u * 20 + k * 8) * 2;
        pix(ctx, x, y, 1, 1, '#ffffff');
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'spark': {
      const [x, y] = P(f.x, f.y, f.z);
      const r = 1 + k * 4;
      ctx.globalAlpha = 1 - k;
      pix(ctx, x - r, y, r * 2, 1, f.c); pix(ctx, x, y - r, 1, r * 2, f.c);
      ctx.globalAlpha = 1;
      break;
    }
    case 'glow': {
      const [x, y] = P(f.x, f.y, f.z);
      ctx.fillStyle = f.c; ctx.globalAlpha = 0.6 * (1 - k);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      break;
    }
    case 'flash': {
      const [x, y] = P(f.x, f.y, f.z);
      pix(ctx, x - 2, y - 2, 4, 4, '#fff4b0');
      break;
    }
    case 'expl': {
      const [x, y] = P(f.x, f.y, 0);
      const s = f.size, r = (4 + k * 14) * s;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = k < 0.3 ? '#fff6c0' : '#ff9a20';
      ctx.beginPath(); ctx.arc(x, y - r * 0.6, r, 0, 7); ctx.fill();
      ctx.fillStyle = k < 0.5 ? '#ffcf40' : '#c04010';
      ctx.beginPath(); ctx.arc(x, y - r * 0.6, r * 0.6, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'part': {
      const [x, y] = P(f.x, f.y, f.z);
      ctx.globalAlpha = 1 - k; pix(ctx, x, y, 2, 2, f.c); ctx.globalAlpha = 1;
      break;
    }
    case 'smoke': {
      const [x, y] = P(f.x, f.y, f.z);
      ctx.globalAlpha = (1 - k) * 0.45;
      ctx.fillStyle = f.light ? '#e8eef2' : '#444';
      ctx.beginPath(); ctx.arc(x, y, 2 + k * 6, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'fire': {
      const [x, y] = P(f.x, f.y, f.z);
      ctx.globalAlpha = 1 - k;
      pix(ctx, x - 1, y - 4 - k * 6, 3, 4, k < 0.5 ? '#ffd040' : '#ff6020');
      ctx.globalAlpha = 1;
      break;
    }
    case 'shock': {
      const [x, y] = P(f.x, f.y, 0);
      const r = 10 + k * 90;
      ctx.strokeStyle = '#fff2c0'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = Math.max(0, 0.5 - k);
      ctx.fillRect(0, 0, R.w, R.h);
      ctx.globalAlpha = 1;
      break;
    }
    case 'marker': {
      const [x, y] = P(f.x, f.y, 0);
      const r = 10 * (1 - k);
      ctx.strokeStyle = f.c; ctx.lineWidth = 1; ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
  }
}
function drawGroundEffect(ctx, f) {
  const k = f.t / f.dur;
  if (f.k === 'scorch') {
    const [x, y] = P(f.x, f.y, 0);
    ctx.fillStyle = `rgba(20,15,10,${0.5 * (1 - k)})`;
    ctx.beginPath(); ctx.ellipse(x, y, f.r * HW * 1.4, f.r * HH * 1.4, 0, 0, 7); ctx.fill();
  } else if (f.k === 'corpse') {
    const [x, y] = P(f.x, f.y, 0);
    ctx.globalAlpha = 1 - k; pix(ctx, x - 3, y - 1, 6, 2, shade(f.c, 0.6)); pix(ctx, x + 3, y - 1, 2, 2, '#c09070'); ctx.globalAlpha = 1;
  } else if (f.k === 'wreck') {
    ctx.globalAlpha = Math.min(1, (1 - k) * 2);
    rotBox(ctx, f.x, f.y, f.dir, f.L, f.W, 0, 3, '#2a2724', '#35312c');
    ctx.globalAlpha = 1;
    if (Math.random() < 0.1 && k < 0.6) G.effects.push({ k: 'smoke', x: f.x, y: f.y, z: 4, t: 0, dur: 1.2 });
  }
}
function drawProj(ctx, p) {
  const k = p.t / p.dur;
  const arc = p.k === 'missile' ? Math.sin(k * Math.PI) * 18 : p.k === 'shell' ? Math.sin(k * Math.PI) * 4 : 0;
  const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k, z = p.z0 + (p.z1 - p.z0) * k + arc;
  const [sx, sy] = P(x, y, z);
  if (p.k === 'bullet') {
    const k2 = Math.max(0, k - 0.15);
    const [bx, by] = P(p.x0 + (p.x1 - p.x0) * k2, p.y0 + (p.y1 - p.y0) * k2, p.z0 + (p.z1 - p.z0) * k2);
    line(ctx, [bx, by], [sx, sy], p.c, 1);
  } else if (p.k === 'shell') {
    pix(ctx, sx - 1, sy - 1, 2, 2, '#ffe080');
  } else {
    pix(ctx, sx - 1, sy - 1, 3, 2, '#ddd'); pix(ctx, sx - 1, sy, 1, 1, '#ff8030');
  }
}

// ===== 超級武器 / 老兵 =====
function drawStrike(ctx, s) {
  if (s.k === 'orbital') {
    const [gx, gy] = P(s.cx, s.cy, 0);
    if (s.t < 1) {
      // 瞄準光束
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(s.t * 30);
      line(ctx, [gx, gy], [gx, -10], '#ff8090', 1);
      ctx.strokeStyle = '#ff3048'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(gx, gy, 50 * (1 - s.t) + 10, (50 * (1 - s.t) + 10) / 2, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    const fade = Math.min(1, (s.dur - s.t) / 0.5);
    const w = (14 + Math.sin(s.t * 25) * 3) * fade;
    ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#ff3048';
    ctx.fillRect(gx - w * 1.6, -10, w * 3.2, gy + 10);
    ctx.beginPath(); ctx.ellipse(gx, gy, w * 3, w * 1.5, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = '#ff6070';
    ctx.fillRect(gx - w / 2, -10, w, gy + 10);
    ctx.fillStyle = '#fff0f2';
    ctx.fillRect(gx - w / 5, -10, w / 2.5, gy + 10);
    ctx.beginPath(); ctx.ellipse(gx, gy, w * 1.4, w * 0.7, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    const [gx, gy] = P(s.x, s.y, 0);
    // 目標標記
    if (Math.sin(s.t * 14) > 0) {
      ctx.strokeStyle = '#ff3030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(gx, gy, 3.2 * HW * 1.4, 3.2 * HH * 1.4, 0, 0, 7); ctx.stroke();
      line(ctx, [gx - 8, gy], [gx + 8, gy], '#ff3030', 1); line(ctx, [gx, gy - 4], [gx, gy + 4], '#ff3030', 1);
    }
    if (s.t < 0.9) {
      const [mx, my] = P(s.sx, s.sy, 8 + s.t * s.t * 500);
      pix(ctx, mx - 1, my - 6, 3, 8, '#e8e8e8');
      pix(ctx, mx - 1, my + 2, 3, 3, '#ffb030');
      if (Math.random() < 0.8) G.effects.push({ k: 'smoke', x: s.sx, y: s.sy, z: 8 + s.t * s.t * 500, t: 0, dur: 1.5, light: true });
    } else {
      const f = (s.t - 0.9) / (s.dur - 0.9);
      const z = 520 * (1 - f) * (1 - f);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(gx, gy, 3 + f * 8, 1.5 + f * 4, 0, 0, 7); ctx.fill();
      const [mx, my] = P(s.x, s.y, z);
      pix(ctx, mx - 1, my - 8, 3, 8, '#e8e8e8');
      pix(ctx, mx - 1, my - 12, 3, 4, '#ffb030');
    }
  }
}
function drawRank(ctx, e) {
  const z = e.def.cat === 'inf' ? 15 : (e.def.look.H || 5) + 12;
  const [sx, sy] = P(e.x, e.y, z);
  const x = sx + (e.def.cat === 'inf' ? 6 : 10), y = sy - 2;
  for (let k = 0; k < e.rank; k++) {
    const yy = y + k * 3;
    pix(ctx, x, yy + 1, 1, 1, '#ffd040'); pix(ctx, x + 1, yy, 1, 1, '#ffd040'); pix(ctx, x + 2, yy + 1, 1, 1, '#ffd040');
  }
}

// ===== 主渲染 =====
function render() {
  const ctx = R.ctx, m = G.map, p = me();
  ctx.fillStyle = '#0a0c0e'; ctx.fillRect(0, 0, R.w, R.h);
  ctx.drawImage(R.terrain, Math.round(-R.ox - R.camX), Math.round(-R.camY));
  // 水面閃爍
  // 可視磚格範圍
  const corners = [screenToWorld(0, 0), screenToWorld(R.w, 0), screenToWorld(0, R.h), screenToWorld(R.w, R.h)];
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 2), x1 = Math.min(MAP_W - 1, Math.ceil(Math.max(...corners.map(c => c[0]))) + 2);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 2), y1 = Math.min(MAP_H - 1, Math.ceil(Math.max(...corners.map(c => c[1]))) + 2);
  const onScreen = (x, y, pad = 60) => { const [sx, sy] = P(x, y, 0); return sx > -pad && sx < R.w + pad && sy > -pad && sy < R.h + pad * 1.5; };

  // 水面動畫
  const wt = G.time;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = m.idx(x, y);
    if (m.terrain[i] !== T_WATER) continue;
    if (((m.variant[i] + Math.floor(wt * 2)) % 7) === 0) {
      const [sx, sy] = P(x + 0.5, y + 0.5, 0);
      pix(ctx, sx - 3 + (m.variant[i] % 5), sy - 1, 4, 1, 'rgba(180,220,255,0.5)');
    }
  }
  drawOre(ctx, x0, y0, x1, y1);
  for (const f of G.effects) if (f.k === 'scorch' || f.k === 'corpse' || f.k === 'wreck') if (onScreen(f.x, f.y)) drawGroundEffect(ctx, f);

  // 建築放置預覽(地面)
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
  for (const f of G.effects) if (f.k !== 'scorch' && f.k !== 'corpse' && f.k !== 'wreck' && f.k !== 'shock' && onScreen(f.x !== undefined ? f.x : f.x1, f.y !== undefined ? f.y : f.y1, 200)) drawEffect(ctx, f);

  // 生命條
  for (const e of list) {
    if (e.kind === 'doodad') continue;
    const sel = G.sel.includes(e);
    if (sel || e === UI.hoverEnt || (e.hp < e.maxHp && G.time - e.hitT < 3)) drawHealth(ctx, e, sel);
    if (e.kind === 'unit' && e.rank) drawRank(ctx, e);
  }
  // 集結點
  if (p.rally && G.sel.some(e => e.kind === 'bld' && (e.type === 'barracks' || e.type === 'factory'))) {
    const [rx, ry] = P(p.rally[0], p.rally[1], 0);
    line(ctx, [rx, ry], [rx, ry - 12], '#ddd', 1); pix(ctx, rx + 1, ry - 12, 6, 4, p.color);
  }

  // 戰爭迷霧
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = m.idx(x, y);
    if (p.visible[i]) continue;
    const [cx, cy] = P(x, y, 0);
    ctx.fillStyle = p.explored[i] ? 'rgba(0,0,0,0.42)' : '#000';
    ctx.beginPath(); ctx.moveTo(cx, cy - 1); ctx.lineTo(cx + HW + 1, cy + HH); ctx.lineTo(cx, cy + TH + 1); ctx.lineTo(cx - HW - 1, cy + HH); ctx.closePath(); ctx.fill();
  }

  for (const s of G.strikes) drawStrike(ctx, s);
  for (const f of G.effects) if (f.k === 'shock') drawEffect(ctx, f);

  // 框選
  if (UI.drag && UI.drag.active) {
    const d = UI.drag;
    ctx.strokeStyle = '#7fff7f'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.min(d.x0, d.x1) + 0.5, Math.min(d.y0, d.y1) + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
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
    poly(ctx, [P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)], good ? 'rgba(60,255,60,0.35)' : 'rgba(255,40,40,0.45)');
  }
  // 建造範圍
  ctx.globalAlpha = 0.55;
  const ghost = { type, owner: p.id, tx, ty, w: d.w, h: d.h, x: tx + d.w / 2, y: ty + d.h / 2, prog: 1, hp: 1, maxHp: 1, anim: 0, charge: 0, tdir: Math.PI * 0.75, def: d };
  drawBuilding(ctx, ghost);
  ctx.globalAlpha = 1;
}

// ===== 圖示產生 =====
function makeIcon(type, owner) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 48;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const g = ctx.createLinearGradient(0, 0, 0, 48);
  g.addColorStop(0, '#2b3238'); g.addColorStop(1, '#14181c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 48);
  // 以 2 倍像素繪製
  const sm = document.createElement('canvas'); sm.width = 32; sm.height = 24;
  const sc = sm.getContext('2d');
  const save = { camX: R.camX, camY: R.camY };
  const bd = BUILDINGS[type];
  const savedTime = G.time;
  if (bd) {
    const s = Math.max(bd.w, bd.h);
    const scale = s >= 3 ? 0.55 : s === 2 ? 0.75 : 1.1;
    sc.save(); sc.scale(scale, scale);
    const ghost = { type, owner, tx: 0, ty: 0, w: bd.w, h: bd.h, x: bd.w / 2, y: bd.h / 2, prog: 1, hp: 1, maxHp: 1, anim: 0, charge: 0, tdir: Math.PI * 0.75, def: bd };
    const [cx, cy] = [(ghost.x - ghost.y) * HW, (ghost.x + ghost.y) * HH];
    R.camX = cx - 16 / scale; R.camY = cy - 16 / scale;
    const effLen = G.effects.length;
    drawBuilding(sc, ghost);
    G.effects.length = effLen;
    sc.restore();
  } else {
    const u = { def: UNITS[type], type, owner, x: 0.5, y: 0.5, dir: Math.PI * 0.75, tdir: Math.PI * 0.75, moving: false, anim: 0, cool: 0, cargo: 0, weapon: UNITS[type].weapon ? WEAPONS[UNITS[type].weapon] : { rof: 1 }, id: 0 };
    const isInf = UNITS[type].cat === 'inf';
    const scale = isInf ? 1.6 : 1.1;
    sc.save(); sc.scale(scale, scale);
    R.camX = (0.5 - 0.5) * HW - 16 / scale; R.camY = HH - (isInf ? 18 : 15) / scale;
    drawUnit(sc, u);
    sc.restore();
  }
  R.camX = save.camX; R.camY = save.camY; G.time = savedTime;
  ctx.drawImage(sm, 0, 0, 64, 48);
  return cv;
}
