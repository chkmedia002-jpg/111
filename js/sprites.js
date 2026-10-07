'use strict';
// ===== 美術圖素材:載入與繪製(靜態圖 / 逐格動畫 + 程式動作)=====
const SPRITES = {};
function _loadImg(src, onok) { const img = new Image(); img.onload = onok; img.src = src; return img; }
for (const [k, d] of Object.entries(typeof SPRITE_DATA !== 'undefined' ? SPRITE_DATA : {})) {
  const s = SPRITES[k] = Object.assign({ ok: false, anims: {} }, d, { anims: {}, key: k });
  s.img = _loadImg(d.src, () => { s.ok = true; });
  // 3D 渲染的多方向走路畫格
  if (d.dirs) {
    s.dirs = {};
    for (const [name, dd] of Object.entries(d.dirs)) {
      const set = s.dirs[name] = { stand: dd.stand, imgs: [], atk: [], loaded: 0 };
      set.imgs = dd.frames.map(src => _loadImg(src, () => { set.loaded++; }));
      set.atk = (dd.attack || []).map(src => _loadImg(src, () => { set.loaded++; }));
    }
  }
  for (const [state, a] of Object.entries(d.anims || {})) {
    const an = s.anims[state] = { w: a.w, h: a.h, ax: a.ax, ay: a.ay, fps: a.fps, imgs: [], loaded: 0 };
    an.imgs = a.frames.map(src => _loadImg(src, () => { an.loaded++; }));
  }
}
// 時代專屬圖優先(如 ming_harvester),再找單位代號
function spriteFor(u) { const s = SPRITES[G.era + '_' + u.type] || SPRITES[u.type]; return s && s.ok ? s : null; }
function animReady(s, state) { const a = s.anims[state]; return a && a.loaded === a.imgs.length ? a : null; }

// 8 方位 → [畫格組, 是否翻轉](世界方向 0 = 畫面右下,每 45° 一格)
const DIR8 = [['se', false], ['s', false], ['se', true], ['e', true], ['ne', true], ['n', false], ['ne', false], ['e', false]];

// 原圖面向右下;面向左邊時水平翻轉。
// walk 依移動距離換格(腳步與地面同步);attack 依攻擊冷卻換格;idle/death 依時間換格。
function drawSpriteUnit(ctx, u, s) {
  const [sx, sy] = P(u.x, u.y, 0);
  const fx = Math.cos(u.dir) - Math.sin(u.dir);
  if (fx < -0.1) u._flip = true; else if (fx > 0.1) u._flip = false;
  let flip = !!u._flip;
  // 多方向畫格:依世界方向取最近的 8 方位;左側三個方位用右側畫格水平翻轉
  let dirSet = null;
  if (s.dirs) {
    const k = ((Math.round(u.dir / (Math.PI / 4)) % 8) + 8) % 8;
    const [name, fl] = DIR8[k];
    const set = s.dirs[name];
    if (set && set.loaded === set.imgs.length + set.atk.length) { dirSet = set; flip = fl; }
  }
  const s0 = s;   // 光圈、陰影大小以斜向圖為準,切換視角時不跳動
  // 載具有正側面圖(代號_side,原圖面向左)時:畫面上橫向或往上走用側面,往下走用斜向
  const side = s.veh && SPRITES[s.key + '_side'];
  if (side && side.ok) {
    const fy = (Math.cos(u.dir) + Math.sin(u.dir)) / 2, len = Math.hypot(fx, fy) || 1;
    const down = fy / len;
    if (down < 0.3) u._side = true; else if (down > 0.45) u._side = false;   // 遲滯,避免來回切換
    if (u._side) { s = side; flip = fx > 0; }
  }
  const sd = flip ? -1 : 1;
  // 攻擊動作的時間長度:有逐格斬擊時拉長,讓舉刀、斬落、收勢看得清楚
  const win = u.weapon ? (dirSet && dirSet.atk.length ? Math.min(0.6, u.weapon.rof * 0.65) : 0.35) : 0.35;
  const atk = u.weapon && u.cool > u.weapon.rof - win ? (u.cool - (u.weapon.rof - win)) / win : 0;
  // 選擇畫格
  let pic = s, img = s.img, framed = false;
  const walkA = u.moving && (dirSet ? { imgs: dirSet.imgs } : animReady(s, 'walk'));
  const atkA = atk > 0 && (dirSet && dirSet.atk.length ? { imgs: dirSet.atk } : animReady(s, 'attack'));
  const idleA = !u.moving && atk === 0 && animReady(s, 'idle');
  if (dirSet && atk > 0 && dirSet.atk.length) {
    // 斬擊:出手後依冷卻進度播放(舉刀 → 斬落 → 收勢)
    pic = s; framed = true;
    img = dirSet.atk[Math.min(dirSet.atk.length - 1, Math.floor((1 - atk) * dirSet.atk.length))];
  } else if (dirSet) {
    pic = s; framed = true;
    // anim 每走一格 +6;每 0.55 換一格 → 約 0.7 格走完一個步行循環
    img = u.moving ? dirSet.imgs[Math.floor((u.anim || 0) / 0.55) % dirSet.imgs.length] : dirSet.imgs[dirSet.stand];
  } else if (atkA) { const n = atkA.imgs.length; pic = atkA; img = atkA.imgs[Math.min(n - 1, Math.floor((1 - atk) * n))]; framed = true; }
  else if (walkA) { pic = walkA; img = walkA.imgs[Math.floor((u.anim || 0) / 0.75) % walkA.imgs.length]; framed = true; }
  else if (idleA) { pic = idleA; img = idleA.imgs[Math.floor((G.time + (u.id || 0) * 0.37) * idleA.fps) % idleA.imgs.length]; framed = true; }
  // 程式動作:有逐格動畫時減弱,避免動作過度
  const ph = (u.anim || 0) * 2;
  const bob = s.veh ? (u.moving ? Math.abs(Math.sin(ph)) * 0.3 : 0)
    : u.moving ? Math.abs(Math.sin(ph)) * (walkA ? 0.35 : 1.3) : framed ? 0 : Math.sin(G.time * 2 + (u.id || 0)) * 0.15;
  const sway = u.moving && !walkA && !s.veh ? Math.sin(ph) * 0.07 : 0;
  const lunge = atk > 0 ? Math.sin(atk * Math.PI) * (atkA ? 1 : 2.4) : 0;
  const tilt = atk > 0 && !atkA ? Math.sin(atk * Math.PI) * 0.14 : 0;
  // 陰影與陣營色光圈
  if (s.veh) softShadow(ctx, u.x, u.y, s0.w * 0.5, s0.w * 0.2, 0.45);
  else softShadow(ctx, u.x, u.y, (s0.ring || s.w) * 0.42, (s0.ring || s.w) * 0.17, 0.5);
  const col = G.players[u.owner] ? G.players[u.owner].color : '#fff';
  pushA(ctx, 0.75);
  ctx.strokeStyle = col; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.ellipse(sx, sy, (s0.ring || s0.w) * 0.36, (s0.ring || s0.w) * 0.15, 0, 0, 6.2832); ctx.stroke();
  popA(ctx);
  ctx.save();
  ctx.translate(sx + sd * lunge, sy - bob);
  ctx.rotate(sd * (sway + tilt));
  if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, -pic.ax, -pic.ay, pic.w, pic.h);
  if (s.veh) drawVehicleParts(ctx, u, s);
  if (G.time - (u.hitT || -99) < 0.08) {
    ctx.globalCompositeOperation = 'lighter'; pushA(ctx, 0.35);
    ctx.drawImage(img, -pic.ax, -pic.ay, pic.w, pic.h);
    popA(ctx); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ===== 載具零件:車斗貨物 + 依移動距離滾動的車輪(座標以錨點為原點,已含翻轉)=====
function drawVehicleParts(ctx, u, s) {
  if (s.bed) drawBedCargo(ctx, u, s.bed);
  const [ax, ay] = s.axis;
  for (const [wx, wy, r] of s.wheels || []) {
    // anim 每走一格 +6,一格沿車軸約 22 邏輯像素 → 轉角 = 距離 / 半徑
    const rot = (u.anim || 0) / 6 * 22.4 / r;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.transform(ax, ay, 0, 1, 0, 0);     // 車輪立在車軸與垂直方向構成的平面上
    // 輪框
    ctx.lineWidth = r * 0.24; ctx.strokeStyle = '#3e2a18';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = r * 0.1; ctx.strokeStyle = '#8a6440';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 3.6, 5.6); ctx.stroke();
    // 輻條
    ctx.lineWidth = r * 0.11; ctx.strokeStyle = '#6a4a2c'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4; ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); }
    ctx.stroke(); ctx.lineCap = 'butt';
    // 輪轂
    ctx.fillStyle = '#4a3420'; ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#a07a50'; ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.05, r * 0.12, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
}

// 車斗貨物:木材、石材、銀礦,依裝載量增加
function drawBedCargo(ctx, u, bed) {
  const fill = clamp((u.cargo || 0) / HARV_CAP, 0, 1);
  if (fill < 0.03) return;
  const [cx, cy, hx, hy, wx, wy] = bed;
  const at = (a, b, z) => [cx + hx * a + wx * b, cy + hy * a + wy * b - z];   // a、b ∈ [-1,1]:沿車長、車寬
  if (u.cargoKind === 'wood') {
    const n = 1 + Math.round(fill * 5);
    const flat = Math.abs(wx) + Math.abs(wy) < 0.6;   // 正側面:看不到車寬,改成一層層往上疊
    if (flat) {
      const layers = 1 + Math.round(fill * 2);
      for (let k = 0; k < layers; k++) {
        const z = 0.75 + k * 1.3, inset = k * 0.08;
        const p0 = at(-0.95 + inset, 0, z), p1 = at(0.85 - inset, 0, z);
        ctx.lineCap = 'round';
        line(ctx, p0, p1, '#3e2a18', 1.45);
        line(ctx, [p0[0], p0[1] - 0.15], [p1[0], p1[1] - 0.15], '#6e4c2c', 1.05);
        line(ctx, [p0[0], p0[1] - 0.45], [p1[0], p1[1] - 0.45], '#a47c50', 0.3);
        ctx.lineCap = 'butt';
      }
      return;
    }
    for (let k = 0; k < n; k++) {
      const row = k % 3, lay = Math.floor(k / 3);
      const b = -0.6 + row * 0.6, z = 0.6 + lay * 0.9;
      const p0 = at(-0.95, b, z), p1 = at(0.85, b, z);
      ctx.lineCap = 'round';
      line(ctx, p0, p1, '#5e4026', 1.5); line(ctx, [p0[0], p0[1] - 0.4], [p1[0], p1[1] - 0.4], '#94704a', 0.45);
      ctx.lineCap = 'butt';
      ell(ctx, p1[0], p1[1], 0.72, 0.72, '#d6ae78'); ell(ctx, p1[0], p1[1], 0.28, 0.28, '#9a7246');
    }
  } else if (u.cargoKind === 'stone') {
    // 石塊:兩排堆疊
    const n = 2 + Math.round(fill * 5);
    for (let k = 0; k < n; k++) {
      const lay = Math.floor(k / 4), i = k % 4;
      const [px, py] = at(-0.75 + i * 0.5, lay ? 0 : (i % 2 ? 0.45 : -0.45), 0.9 + lay * 1.1);
      const r = 1.25 + hash(u.id * 7 + k) * 0.45;
      ell(ctx, px + 0.2, py + r * 0.45, r * 0.95, r * 0.35, 'rgba(0,0,0,0.3)');
      poly(ctx, [[px - r, py + r * 0.1], [px - r * 0.5, py - r * 0.8], [px + r * 0.7, py - r * 0.75], [px + r, py + r * 0.2], [px + r * 0.1, py + r * 0.6]], k % 2 ? '#86817a' : '#9c978d');
      poly(ctx, [[px - r * 0.5, py - r * 0.8], [px + r * 0.7, py - r * 0.75], [px + r * 0.15, py - r * 0.15], [px - r * 0.6, py - r * 0.1]], '#c4bfb4');
    }
  } else {
    // 銀礦:帶銀脈的礦石,裝得多時頂上放銀錠
    const n = 2 + Math.round(fill * 4);
    for (let k = 0; k < n; k++) {
      const lay = Math.floor(k / 4), i = k % 4;
      const [px, py] = at(-0.7 + i * 0.47, lay ? 0 : (i % 2 ? 0.4 : -0.4), 0.9 + lay * 1);
      const r = 1.15 + hash(u.id * 5 + k) * 0.4;
      ell(ctx, px + 0.2, py + r * 0.45, r, r * 0.35, 'rgba(0,0,0,0.3)');
      poly(ctx, [[px - r, py], [px - r * 0.6, py - r * 0.9], [px + r * 0.3, py - r], [px + r, py - r * 0.3], [px + r * 0.7, py + r * 0.35], [px - r * 0.3, py + r * 0.4]], '#55585e');
      poly(ctx, [[px - r * 0.6, py - r * 0.9], [px + r * 0.3, py - r], [px + r * 0.2, py - r * 0.3], [px - r * 0.5, py - r * 0.25]], '#71757b');
      line(ctx, [px - r * 0.7, py - r * 0.2], [px - r * 0.1, py - r * 0.55], '#e8ecf2', 0.3);
      line(ctx, [px - r * 0.1, py - r * 0.55], [px + r * 0.6, py - r * 0.35], '#e8ecf2', 0.3);
    }
    if (fill > 0.5) {
      // 銀錠(元寶)
      const [px, py] = at(0, 0, 2.3);
      ctx.fillStyle = '#9aa2ac';
      ctx.beginPath(); ctx.moveTo(px - 1.6, py - 1); ctx.quadraticCurveTo(px - 1, py + 0.4, px, py + 0.4); ctx.quadraticCurveTo(px + 1, py + 0.4, px + 1.6, py - 1);
      ctx.quadraticCurveTo(px, py - 0.4, px - 1.6, py - 1); ctx.fill();
      ell(ctx, px, py - 0.85, 0.6, 0.35, '#e4e8ee'); circ(ctx, px - 0.9, py - 1.1, 0.25, '#ffffff');
    }
  }
}

// ===== 建築美術圖 =====
// 素材代號:陣營專屬建築用原代號(如 jp_turret),共用建築用「陣營_類型」(如 jp_barracks)
function buildingSprite(b) {
  const f = G.players[b.owner] && G.players[b.owner].faction;
  const s = SPRITES[b.type.includes('_') ? b.type : f + '_' + b.type];
  return s && s.ok && s.bld ? s : null;
}
// 圖片寬度對齊地面菱形寬度,底部對齊菱形前角;施工時由下往上長出
function drawBuildingSprite(ctx, b, s) {
  const west = P(b.tx, b.ty + b.h, 0), east = P(b.tx + b.w, b.ty, 0), front = P(b.tx + b.w, b.ty + b.h, 0);
  const dw = (east[0] - west[0]) * (s.fit || 1.04), k = dw / s.iw, dh = s.ih * k;
  const x = (west[0] + east[0]) / 2 - dw / 2, y = front[1] - dh + 1;
  const prog = b.prog < 1 && !b.ghost ? b.prog : 1;
  pushA(ctx, 0.3);
  poly(ctx, [P(b.tx - 0.1, b.ty - 0.1), P(b.tx + b.w + 0.15, b.ty - 0.1), P(b.tx + b.w + 0.15, b.ty + b.h + 0.15), P(b.tx - 0.1, b.ty + b.h + 0.15)], '#000');
  popA(ctx);
  ctx.imageSmoothingEnabled = true;
  const sh = s.img.naturalHeight * prog;
  ctx.drawImage(s.img, 0, s.img.naturalHeight - sh, s.img.naturalWidth, sh, x, y + dh * (1 - prog), dw, dh * prog);
  if (G.time - (b.hitT || -99) < 0.08) {
    ctx.globalCompositeOperation = 'lighter'; pushA(ctx, 0.25);
    ctx.drawImage(s.img, 0, s.img.naturalHeight - sh, s.img.naturalWidth, sh, x, y + dh * (1 - prog), dw, dh * prog);
    popA(ctx); ctx.globalCompositeOperation = 'source-over';
  }
  b._sprTop = y;
}
