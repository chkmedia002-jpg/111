'use strict';
// ===== 美術圖素材:載入與繪製(靜態圖 + 程式動作)=====
const SPRITES = {};
for (const [k, d] of Object.entries(typeof SPRITE_DATA !== 'undefined' ? SPRITE_DATA : {})) {
  const img = new Image();
  SPRITES[k] = Object.assign({ img, ok: false }, d);
  img.onload = () => { SPRITES[k].ok = true; };
  img.src = d.src;
}
function spriteFor(u) { const s = SPRITES[u.type]; return s && s.ok ? s : null; }

// 原圖面向右下;面向左邊時水平翻轉。走路時彈跳搖擺,攻擊時前衝。
function drawSpriteUnit(ctx, u, s) {
  const [sx, sy] = P(u.x, u.y, 0);
  const fx = Math.cos(u.dir) - Math.sin(u.dir);
  if (fx < -0.1) u._flip = true; else if (fx > 0.1) u._flip = false;
  const flip = !!u._flip, sd = flip ? -1 : 1;
  const ph = (u.anim || 0) * 2;
  const bob = u.moving ? Math.abs(Math.sin(ph)) * 1.3 : Math.sin(G.time * 2 + (u.id || 0)) * 0.15;
  const sway = u.moving ? Math.sin(ph) * 0.07 : 0;
  const atk = u.weapon && u.cool > u.weapon.rof - 0.35 ? (u.cool - (u.weapon.rof - 0.35)) / 0.35 : 0;
  const lunge = atk > 0 ? Math.sin(atk * Math.PI) * 2.4 : 0;
  const tilt = atk > 0 ? Math.sin(atk * Math.PI) * 0.14 : 0;
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
  ctx.drawImage(s.img, -s.ax, -s.ay, s.w, s.h);
  // 受擊閃白
  if (G.time - (u.hitT || -99) < 0.08) {
    ctx.globalCompositeOperation = 'lighter'; pushA(ctx, 0.35);
    ctx.drawImage(s.img, -s.ax, -s.ay, s.w, s.h);
    popA(ctx); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
