'use strict';
// ===== 介面與輸入 =====
const UI = {
  placing: null, placeAt: null, hoverTile: null, hoverEnt: null, drag: null, mode: null,
  tab: 'bld', mouse: { x: 0, y: 0, in: false }, keys: {}, alertAt: null, icons: {},
  sig: '', lastClick: { t: 0, id: 0 }, pan: null, shownCredits: 0,

  message(text) {
    const box = document.getElementById('msg');
    if (!box) return;
    const el = document.createElement('div');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600); }, 3500);
  }
};

function $(id) { return document.getElementById(id); }

// ===== 側邊欄 =====
function initSidebar() {
  const p = me();
  UI.icons = {};
  for (const cat of CATS) for (const t of typesFor(p, cat)) UI.icons[t] = makeIcon(t, p.id);
  document.querySelectorAll('#tabs button').forEach(b => {
    b.onclick = () => { UI.tab = b.dataset.tab; UI.sig = ''; sfx('click'); };
  });
  $('btn-repair').onclick = () => { UI.mode = UI.mode === 'repair' ? null : 'repair'; UI.placing = null; sfx('click'); };
  $('btn-sell').onclick = () => { UI.mode = UI.mode === 'sell' ? null : 'sell'; UI.placing = null; sfx('click'); };
  $('btn-sound').onclick = () => { Audio2.on = !Audio2.on; $('btn-sound').textContent = Audio2.on ? '🔊' : '🔇'; if (!Audio2.on && window.speechSynthesis) speechSynthesis.cancel(); };
  $('btn-help').onclick = () => toggleHelp();
  UI.sig = '';
}

function rebuildGrid() {
  const p = me(), grid = $('buildgrid');
  grid.innerHTML = '';
  const types = typesFor(p, UI.tab);
  for (const t of types) {
    const d = getDef(t);
    const ok = canBuildType(p, t);
    const el = document.createElement('div');
    el.className = 'item' + (ok ? '' : ' locked');
    el.dataset.type = t;
    el.appendChild(UI.icons[t]);
    el.insertAdjacentHTML('beforeend', `<div class="prog"></div><div class="nm">${d.name}</div><div class="cnt"></div><div class="rdy">就緒</div>`);
    const reqTxt = d.req.length ? '需要:' + d.req.map(r => BUILDINGS[r].name).join('、') : '';
    el.title = `${d.name}  $${d.cost}\n${d.desc || ''}${ok ? '' : '\n' + reqTxt}\n左鍵:建造/排程(Shift ×5) 右鍵:暫停/取消`;
    el.onmousedown = ev => {
      ev.preventDefault();
      if (!canBuildType(p, t)) { eva('條件不足', false); return; }
      const q = p.queues[d.cat];
      if (ev.button === 2) { cancelItem(p, t); return; }
      if (ev.button !== 0) return;
      if (q.ready === t) { UI.placing = t; UI.mode = null; sfx('click'); return; }
      if (q.cur && q.cur.type === t && q.paused) { q.paused = false; eva('繼續', false); return; }
      const n = ev.shiftKey && !isBuildingType(t) ? 5 : 1;
      for (let i = 0; i < n; i++) queueItem(p, t);
    };
    el.oncontextmenu = ev => ev.preventDefault();
    grid.appendChild(el);
  }
}

function updateSidebar() {
  const p = me();
  // 依可用狀態決定是否重建
  const sig = UI.tab + '|' + typesFor(p, UI.tab).map(t => canBuildType(p, t) ? 1 : 0).join('');
  if (sig !== UI.sig) { UI.sig = sig; rebuildGrid(); }
  document.querySelectorAll('#tabs button').forEach(b => {
    const q = p.queues[b.dataset.tab];
    b.classList.toggle('active', b.dataset.tab === UI.tab);
    b.classList.toggle('flash', !!q.ready && b.dataset.tab !== UI.tab);
  });
  for (const el of $('buildgrid').children) {
    const t = el.dataset.type, d = getDef(t), q = p.queues[d.cat];
    let prog = 0, cnt = q.list.filter(x => x === t).length;
    if (q.cur && q.cur.type === t) { prog = q.cur.spent / d.cost; cnt++; }
    const ready = q.ready === t;
    el.classList.toggle('ready', ready);
    el.classList.toggle('paused', !!(q.cur && q.cur.type === t && q.paused));
    el.classList.toggle('busy', isBuildingType(t) && !ready && !!(q.cur || q.ready) && !(q.cur && q.cur.type === t));
    const pr = el.querySelector('.prog');
    pr.style.background = prog > 0 ? `conic-gradient(rgba(0,0,0,0) ${prog * 360}deg, rgba(0,0,0,0.65) ${prog * 360}deg)` : '';
    el.querySelector('.cnt').textContent = cnt > 1 ? cnt : '';
  }
  // 資金
  UI.shownCredits += (p.credits - UI.shownCredits) * 0.25;
  if (Math.abs(p.credits - UI.shownCredits) < 1) UI.shownCredits = p.credits;
  $('credits').textContent = '$ ' + Math.floor(UI.shownCredits).toLocaleString();
  // 電力
  const max = Math.max(200, p.powerProd, p.powerUse) * 1.15;
  $('power-fill').style.height = (p.powerProd / max * 100) + '%';
  $('power-fill').className = p.lowPower ? 'low' : (p.powerProd - p.powerUse < 30 ? 'warn' : '');
  $('power-use').style.bottom = (p.powerUse / max * 100) + '%';
  $('powerbar').title = `電力 ${Math.round(p.powerUse)} / ${Math.round(p.powerProd)}`;
  $('power-txt').textContent = `${Math.round(p.powerUse)}/${Math.round(p.powerProd)}`;
  updateSuperPanel();
  $('btn-repair').classList.toggle('on', UI.mode === 'repair');
  $('btn-sell').classList.toggle('on', UI.mode === 'sell');
  updateInfo();
}

function updateSuperPanel() {
  const el = $('super');
  const b = G.entities.find(e => e.alive && e.owner === G.human && e.def.super && e.prog >= 1);
  if (!b) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const f = b.charge / b.def.charge, ready = f >= 1;
  if (!el.dataset.init) {
    el.dataset.init = 1;
    el.innerHTML = '<div class="sname"></div><div class="sbar"><div class="sfill"></div></div>';
    el.onclick = () => {
      const sb = G.entities.find(e => e.alive && e.owner === G.human && e.def.super && e.prog >= 1);
      if (sb && sb.charge >= sb.def.charge) { UI.mode = 'super'; UI.superB = sb; UI.placing = null; sfx('click'); eva('選擇目標', false); }
    };
  }
  el.classList.toggle('ready', ready);
  el.querySelector('.sname').textContent = b.def.name + (ready ? '  ▶ 點擊發射' : `  ${fmtTime(b.def.charge - b.charge)}`);
  el.querySelector('.sfill').style.width = (f * 100) + '%';
}

function updateInfo() {
  const el = $('info');
  const s = G.sel.filter(e => e.alive);
  if (!s.length) { el.innerHTML = `<span class="dim">遊戲時間 ${fmtTime(G.time)}</span>`; return; }
  if (s.length === 1) {
    const e = s[0], d = e.def, own = e.owner === G.human;
    let extra = '';
    if (e.kind === 'unit' && d.harvester) extra = `<br>載貨:${Math.floor(e.cargo)} / ${HARV_CAP}`;
    if (e.kind === 'unit' && e.weapon) extra = `<br>武器射程:${e.weapon.range}`;
    if (e.kind === 'unit' && !d.harvester) extra += `<br>等級:${VET[e.rank].name}`;
    if (e.kind === 'bld' && d.power) extra = `<br>電力:${d.power > 0 ? '+' : ''}${d.power}`;
    el.innerHTML = `<b style="color:${G.players[e.owner].color}">${d.name}</b>${own ? '' : '(敵方)'}<br>生命:${Math.ceil(e.hp)} / ${e.maxHp}${extra}`;
  } else {
    const counts = {};
    for (const e of s) counts[e.def.name] = (counts[e.def.name] || 0) + 1;
    el.innerHTML = `已選取 ${s.length} 個單位<br>` + Object.entries(counts).map(([n, c]) => `${n} ×${c}`).join('<br>');
  }
}
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; }

// ===== 小地圖 =====
const MM = { k: 240 / ((MAP_W + MAP_H) * HW), t: 0 };
function mmPos(x, y) { return [(R.ox + (x - y) * HW) * MM.k, (x + y) * HH * MM.k]; }
function drawMinimap(dt) {
  MM.t -= dt;
  if (MM.t > 0) return;
  MM.t = 0.25;
  const cv = $('minimap'), ctx = cv.getContext('2d'), p = me(), m = G.map;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(R.miniTerrain, 0, 0);
  const tw = HW * MM.k * 2, th = HH * MM.k * 2;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = m.idx(x, y);
    const [mx, my] = mmPos(x + 0.5, y + 0.5);
    if (!p.explored[i]) { ctx.fillStyle = '#000'; ctx.fillRect(mx - tw / 2 - 0.5, my - th / 2 - 0.5, tw + 1, th + 1); continue; }
    if (m.oreType[i] && m.ore[i] > 30) { ctx.fillStyle = m.oreType[i] === 2 ? '#5fd0ff' : '#e0a83a'; ctx.fillRect(mx - 1, my - 0.5, 2, 1); }
  }
  for (const e of G.entities) {
    if (!e.alive || !isVisible(e)) continue;
    ctx.fillStyle = G.players[e.owner].color;
    if (e.kind === 'bld') {
      const pts = [mmPos(e.tx, e.ty), mmPos(e.tx + e.w, e.ty), mmPos(e.tx + e.w, e.ty + e.h), mmPos(e.tx, e.ty + e.h)];
      ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill();
    } else {
      const [mx, my] = mmPos(e.x, e.y);
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
  }
  // 視野框
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  const k = MM.k;
  ctx.strokeRect((R.camX + R.ox) * k + 0.5, R.camY * k + 0.5, R.w * k, R.h * k);
  if (UI.alertAt && G.time - UI.alertAt[2] < 4 && Math.sin(G.time * 10) > 0) {
    const [ax, ay] = mmPos(UI.alertAt[0], UI.alertAt[1]);
    ctx.strokeStyle = '#ff3030'; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 7); ctx.stroke();
  }
}
function minimapToWorld(ev) {
  const r = $('minimap').getBoundingClientRect();
  const mx = (ev.clientX - r.left) * 240 / r.width, my = (ev.clientY - r.top) * 120 / r.height;
  const ix = mx / MM.k - R.ox, iy = my / MM.k;
  return [(ix / HW + iy / HH) / 2, (iy / HH - ix / HW) / 2];
}

// ===== 選取與滑鼠 =====
function pickEntity(sx, sy) {
  let best = null, bd = 1e9;
  for (const e of G.entities) {
    if (!e.alive || e.kind !== 'unit' || !isVisible(e)) continue;
    const inf = e.def.cat === 'inf';
    const [px, py] = P(e.x, e.y, inf ? 6 : 5);
    const d = Math.hypot(px - sx, py - sy);
    if (d < (inf ? 7 : 12) && d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  for (const zz of [0, 6, 12, 18, 24, 30]) {
    const [wx, wy] = screenToWorld(sx, sy + zz);
    const tx = Math.floor(wx), ty = Math.floor(wy);
    if (!G.map.inb(tx, ty)) continue;
    const id = G.map.bld[G.map.idx(tx, ty)];
    if (id) { const b = G.byId.get(id); if (b && b.alive && isVisible(b)) return b; }
  }
  return null;
}

function mouseLow(ev) {
  const r = R.cv.getBoundingClientRect();
  return [(ev.clientX - r.left) / R.zoom, (ev.clientY - r.top) / R.zoom];
}
function ownSelUnits() { return G.sel.filter(e => e.alive && e.kind === 'unit' && e.owner === G.human); }

function initInput() {
  const cv = R.cv;
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  cv.addEventListener('mousemove', ev => {
    const [x, y] = mouseLow(ev);
    UI.mouse.x = x; UI.mouse.y = y; UI.mouse.in = true;
    if (UI.pan) { R.camX = UI.pan.cx - (x - UI.pan.x); R.camY = UI.pan.cy - (y - UI.pan.y); clampCamera(); return; }
    if (UI.drag) {
      UI.drag.x1 = x; UI.drag.y1 = y;
      if (Math.abs(x - UI.drag.x0) + Math.abs(y - UI.drag.y0) > 4) UI.drag.active = true;
    }
  });
  cv.addEventListener('mouseleave', () => { UI.mouse.in = false; });
  cv.addEventListener('wheel', ev => {
    if (!G.map) return;
    ev.preventDefault();
    const [mx, my] = mouseLow(ev);
    const ix = mx + R.camX, iy = my + R.camY;
    R.zoom = clamp(R.zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), 1.2, 6);
    resize();
    const [nx, ny] = mouseLow(ev);
    R.camX = ix - nx; R.camY = iy - ny;
    clampCamera();
  }, { passive: false });
  cv.addEventListener('mousedown', ev => {
    audioInit();
    if (!G.map || G.over) return;
    const [x, y] = mouseLow(ev);
    if (ev.button === 1) { ev.preventDefault(); UI.pan = { x, y, cx: R.camX, cy: R.camY }; return; }
    if (ev.button === 2) { rightClick(x, y, ev); return; }
    if (ev.button !== 0) return;
    if (UI.placing) { tryPlace(); return; }
    if (UI.mode === 'super') {
      const [wx, wy] = screenToWorld(x, y);
      if (UI.superB && G.map.inb(Math.floor(wx), Math.floor(wy))) fireSuper(UI.superB, wx, wy);
      UI.mode = null; UI.superB = null;
      return;
    }
    if (UI.mode) {
      const e = pickEntity(x, y);
      if (e && e.kind === 'bld' && e.owner === G.human) {
        if (UI.mode === 'sell') sellBuilding(e);
        else { e.repairing = !e.repairing; sfx('click'); if (e.repairing) eva('修理中', false); }
      }
      if (!ev.shiftKey) UI.mode = null;
      return;
    }
    UI.drag = { x0: x, y0: y, x1: x, y1: y, active: false, shift: ev.shiftKey };
  });
  window.addEventListener('mouseup', ev => {
    if (ev.button === 1) { UI.pan = null; return; }
    if (ev.button !== 0 || !UI.drag) return;
    const d = UI.drag; UI.drag = null;
    if (!G.map) return;
    if (d.active) boxSelect(d);
    else clickSelect(d.x0, d.y0, d.shift);
  });
  // 小地圖
  const mm = $('minimap');
  let mmDown = false;
  mm.addEventListener('contextmenu', ev => ev.preventDefault());
  mm.addEventListener('mousedown', ev => {
    if (!G.map) return;
    const [wx, wy] = minimapToWorld(ev);
    if (ev.button === 2) { const us = ownSelUnits(); if (us.length) { cmdMove(us, wx, wy, ev.ctrlKey); sfx('ack'); } return; }
    mmDown = true; centerCamera(wx, wy);
  });
  window.addEventListener('mousemove', ev => { if (mmDown) { const [wx, wy] = minimapToWorld(ev); centerCamera(wx, wy); } });
  window.addEventListener('mouseup', () => { mmDown = false; });

  window.addEventListener('keydown', ev => {
    if (!G.map) return;
    UI.keys[ev.key] = true;
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) UI.keys[ev.code] = true;
    const k = ev.key;
    if (k === 'Escape') { UI.placing = null; UI.mode = null; G.sel = []; $('help').classList.add('hidden'); }
    else if (ev.code === 'KeyX') cmdStop(ownSelUnits());
    else if (k === 'h' || k === 'H') { const c = G.entities.find(e => e.alive && e.owner === G.human && e.type === 'conyard') || G.entities.find(e => e.alive && e.owner === G.human); if (c) centerCamera(c.x, c.y); }
    else if (k === ' ') { if (UI.alertAt) centerCamera(UI.alertAt[0], UI.alertAt[1]); ev.preventDefault(); }
    else if ((k === 'a' || k === 'A') && ev.ctrlKey) { ev.preventDefault(); G.sel = G.entities.filter(e => e.alive && e.owner === G.human && e.kind === 'unit' && e.weapon); }
    else if (k === 'q' || k === 'Q') { G.sel = G.entities.filter(e => e.alive && e.owner === G.human && e.kind === 'unit' && e.weapon && onScreenEnt(e)); }
    else if (k === 'p' || k === 'P') togglePause();
    else if (k === 'F1') { ev.preventDefault(); toggleHelp(); }
    else if (/^[1-9]$/.test(k)) {
      if (ev.ctrlKey) { ev.preventDefault(); G.groups[k] = ownSelUnits().slice(); eva(`編組 ${k}`, false); }
      else if (G.groups[k]) {
        const g = G.groups[k].filter(e => e.alive);
        const now = performance.now();
        if (UI.lastGroup === k && now - UI.lastGroupT < 400 && g.length) centerCamera(g[0].x, g[0].y);
        UI.lastGroup = k; UI.lastGroupT = now;
        G.sel = g;
      }
    }
    else if (k === 'Tab') { ev.preventDefault(); UI.tab = CATS[(CATS.indexOf(UI.tab) + 1) % CATS.length]; }
  });
  window.addEventListener('keyup', ev => { UI.keys[ev.key] = false; UI.keys[ev.code] = false; });
  window.addEventListener('blur', () => { UI.keys = {}; });
}

function onScreenEnt(e) { const [sx, sy] = P(e.x, e.y, 0); return sx >= 0 && sy >= 0 && sx <= R.w && sy <= R.h; }

function clickSelect(x, y, shift) {
  const e = pickEntity(x, y);
  if (!e) { if (!shift) G.sel = []; return; }
  const now = performance.now();
  if (e.kind === 'unit' && e.owner === G.human && UI.lastClick.id === e.id && now - UI.lastClick.t < 350) {
    G.sel = G.entities.filter(o => o.alive && o.owner === G.human && o.type === e.type && onScreenEnt(o));
  } else if (shift && e.owner === G.human && e.kind === 'unit') {
    const i = G.sel.indexOf(e);
    if (i >= 0) G.sel.splice(i, 1); else G.sel = G.sel.filter(o => o.kind === 'unit' && o.owner === G.human).concat([e]);
  } else G.sel = [e];
  UI.lastClick = { t: now, id: e.id };
  if (e.owner === G.human) sfx('click');
}

function boxSelect(d) {
  const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
  const found = G.entities.filter(e => {
    if (!e.alive || e.kind !== 'unit' || e.owner !== G.human) return false;
    const [sx, sy] = P(e.x, e.y, 5);
    return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1;
  });
  // 有戰鬥單位時排除採集車
  const combat = found.filter(e => e.weapon);
  const pick = combat.length ? combat : found;
  G.sel = d.shift ? Array.from(new Set(G.sel.concat(pick))) : pick;
  if (pick.length) sfx('ack');
}

function rightClick(x, y, ev) {
  if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; return; }
  const us = ownSelUnits();
  const [wx, wy] = screenToWorld(x, y);
  if (!us.length) {
    // 選取兵營/工廠時設集結點
    if (G.sel.some(e => e.kind === 'bld' && e.owner === G.human && (e.type === 'barracks' || e.type === 'factory'))) {
      me().rally = [wx, wy]; eva('集結點已設定', false); sfx('ack');
    } else G.sel = [];
    return;
  }
  const t = pickEntity(x, y);
  const engs = us.filter(u => u.def.engineer);
  if (engs.length && t && t.kind === 'bld' && (t.owner !== G.human || t.hp < t.maxHp)) {
    cmdCapture(engs, t);
    const rest = us.filter(u => !u.def.engineer);
    if (t.owner !== G.human) cmdAttack(rest, t);
    G.effects.push({ k: 'marker', x: t.x, y: t.y, c: '#ffd040', t: 0, dur: 0.5 });
    sfx('ack');
    return;
  }
  if (t && t.owner !== G.human) {
    cmdAttack(us, t);
    G.effects.push({ k: 'marker', x: t.x, y: t.y, c: '#ff4040', t: 0, dur: 0.5 });
    sfx('ack');
    return;
  }
  // 採集車點礦
  const m = G.map, tx = Math.floor(wx), ty = Math.floor(wy);
  const harv = us.filter(u => u.def.harvester), others = us.filter(u => !u.def.harvester);
  if (harv.length && m.inb(tx, ty) && m.ore[m.idx(tx, ty)] > 10) {
    for (const h of harv) { h.order = { t: 'harvest' }; h.htile = [tx, ty]; h.hstate = 'toOre'; h.pathTo(tx + 0.5, ty + 0.5); }
  } else if (harv.length && t && t.kind === 'bld' && t.type === 'refinery') {
    for (const h of harv) { h.order = { t: 'harvest' }; h.hstate = 'toRef'; h.ref = null; }
  } else if (harv.length) cmdMove(harv, wx, wy, false);
  if (others.length) cmdMove(others, wx, wy, ev.ctrlKey);
  G.effects.push({ k: 'marker', x: wx, y: wy, c: ev.ctrlKey ? '#ff8040' : '#40ff40', t: 0, dur: 0.5 });
  sfx('ack');
}

function tryPlace() {
  const p = me(), type = UI.placing;
  if (!UI.placeAt) return;
  const [tx, ty] = UI.placeAt;
  if (!canPlace(p, type, tx, ty)) { eva('無法在此建造', false); sfx('die'); return; }
  placeBuilding(p, type, tx, ty);
  p.queues[BUILDINGS[type].cat].ready = null;
  UI.placing = null;
  sfx('place');
}

function updateHover() {
  if (!UI.mouse.in) { UI.hoverEnt = null; return; }
  const [wx, wy] = screenToWorld(UI.mouse.x, UI.mouse.y);
  UI.hoverTile = [Math.floor(wx), Math.floor(wy)];
  UI.hoverEnt = pickEntity(UI.mouse.x, UI.mouse.y);
  let cur = 'default';
  if (UI.placing) cur = 'cell';
  else if (UI.mode === 'super') cur = 'crosshair';
  else if (UI.mode === 'sell') cur = 'copy';
  else if (UI.mode === 'repair') cur = 'help';
  else if (UI.hoverEnt && UI.hoverEnt.owner !== G.human && ownSelUnits().some(u => u.weapon)) cur = 'crosshair';
  else if (UI.hoverEnt && UI.hoverEnt.owner === G.human) cur = 'pointer';
  else if (ownSelUnits().length) cur = 'move';
  R.cv.style.cursor = cur;
}

function updateCamera(dt) {
  const sp = 700 * dt;
  let dx = 0, dy = 0;
  const K = UI.keys;
  if (K.ArrowLeft || K.KeyA) dx -= sp; if (K.ArrowRight || K.KeyD) dx += sp;
  if (K.ArrowUp || K.KeyW) dy -= sp; if (K.ArrowDown || K.KeyS) dy += sp;
  if (UI.mouse.in && !UI.pan && !UI.drag) {
    const e = 6;
    if (UI.mouse.x < e) dx -= sp; if (UI.mouse.x > R.w - e) dx += sp;
    if (UI.mouse.y < e) dy -= sp; if (UI.mouse.y > R.h - e) dy += sp;
  }
  if (dx || dy) { R.camX += dx; R.camY += dy; clampCamera(); }
}

// ===== 選單 / 結束 / 說明 =====
function togglePause() {
  G.paused = !G.paused;
  $('pause').classList.toggle('hidden', !G.paused);
}
function toggleHelp() { $('help').classList.toggle('hidden'); }

function endGame(win) {
  G.over = true;
  eva(win ? '任務完成' : '任務失敗');
  const el = $('end');
  el.querySelector('h1').textContent = win ? '勝利' : '戰敗';
  el.querySelector('h1').className = win ? 'win' : 'lose';
  el.querySelector('p').textContent = win ? `敵軍基地已被摧毀。作戰時間 ${fmtTime(G.time)}。` : `我方基地已全數淪陷。作戰時間 ${fmtTime(G.time)}。`;
  setTimeout(() => el.classList.remove('hidden'), 1500);
}
