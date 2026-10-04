'use strict';
// ===== 美術圖素材:載入與繪製(靜態圖 / 逐格動畫 + 程式動作)=====
const SPRITES = {};
function _loadImg(src, onok) { const img = new Image(); img.onload = onok; img.src = src; return img; }
for (const [k, d] of Object.entries(typeof SPRITE_DATA !== 'undefined' ? SPRITE_DATA : {})) {
  const s = SPRITES[k] = Object.assign({ ok: false, anims: {} }, d, { anims: {} });
  s.img = _loadImg(d.src, () => { s.ok = true; });
  for (const [state, a] of Object.entries(d.anims || {})) {
    const an = s.anims[state] = { w: a.w, h: a.h, ax: a.ax, ay: a.ay, fps: a.fps, imgs: [], loaded: 0 };
    an.imgs = a.frames.map(src => _loadImg(src, () => { an.loaded++; }));
  }
}
function spriteFor(u) { const s = SPRITES[u.type]; return s && s.ok ? s : null; }
function animReady(s, state) { const a = s.anims[state]; return a && a.loaded === a.imgs.length ? a : null; }

// 原圖面向右下;面向左邊時水平翻轉。
// walk 依移動距離換格(腳步與地面同步);attack 依攻擊冷卻換格;idle/death 依時間換格。
function drawSpriteUnit(ctx, u, s) {
  const [sx, sy] = P(u.x, u.y, 0);
  const fx = Math.cos(u.dir) - Math.sin(u.dir);
  if (fx < -0.1) u._flip = true; else if (fx > 0.1) u._flip = false;
  const flip = !!u._flip, sd = flip ? -1 : 1;
  const atk = u.weapon && u.cool > u.weapon.rof - 0.35 ? (u.cool - (u.weapon.rof - 0.35)) / 0.35 : 0;
  // 選擇畫格
  let pic = s, img = s.img, framed = false;
  const walkA = u.moving && animReady(s, 'walk');
  const atkA = atk > 0 && animReady(s, 'attack');
  const idleA = !u.moving && atk === 0 && animReady(s, 'idle');
  if (atkA) { const n = atkA.imgs.length; pic = atkA; img = atkA.imgs[Math.min(n - 1, Math.floor((1 - atk) * n))]; framed = true; }
  else if (walkA) { pic = walkA; img = walkA.imgs[Math.floor((u.anim || 0) / 0.75) % walkA.imgs.length]; framed = true; }
  else if (idleA) { pic = idleA; img = idleA.imgs[Math.floor((G.time + (u.id || 0) * 0.37) * idleA.fps) % idleA.imgs.length]; framed = true; }
  // 程式動作:有逐格動畫時減弱,避免動作過度
  const ph = (u.anim || 0) * 2;
  const bob = u.moving ? Math.abs(Math.sin(ph)) * (walkA ? 0.35 : 1.3) : framed ? 0 : Math.sin(G.time * 2 + (u.id || 0)) * 0.15;
  const sway = u.moving && !walkA ? Math.sin(ph) * 0.07 : 0;
  const lunge = atk > 0 ? Math.sin(atk * Math.PI) * (atkA ? 1 : 2.4) : 0;
  const tilt = atk > 0 && !atkA ? Math.sin(atk * Math.PI) * 0.14 : 0;
  // 陰影與陣營色光圈
  softShadow(ctx, u.x, u.y, s.w * 0.42, s.w * 0.17, 0.5);
  const col = G.players[u.owner] ? G.players[u.owner].color : '#fff';
  pushA(ctx, 0.75);
  ctx.strokeStyle = col; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.ellipse(sx, sy, s.w * 0.36, s.w * 0.15, 0, 0, 6.2832); ctx.stroke();
  popA(ctx);
  ctx.save();
  ctx.translate(sx + sd * lunge, sy - bob);
  ctx.rotate(sd * (sway + tilt));
  if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, -pic.ax, -pic.ay, pic.w, pic.h);
  if (G.time - (u.hitT || -99) < 0.08) {
    ctx.globalCompositeOperation = 'lighter'; pushA(ctx, 0.35);
    ctx.drawImage(img, -pic.ax, -pic.ay, pic.w, pic.h);
    popA(ctx); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
