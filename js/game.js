'use strict';
// ===== 遊戲狀態與實體邏輯 =====
const HARV_CAP = 700, HARV_RATE = 110, UNLOAD_RATE = 260;

const G = {
  map: null, entities: [], byId: new Map(), nextId: 1,
  players: [], human: 0, effects: [], projs: [], strikes: [], reveals: [],
  time: 0, over: false, sel: [], groups: {}, speed: 1,
  difficulty: 'normal'
};

function me() { return G.players[G.human]; }
function isEnemy(a, b) { return a !== b; }

// ===== 玩家 =====
function makePlayer(id, faction, isAI, startIdx) {
  const N = MAP_W * MAP_H;
  const queues = {};
  for (const c of CATS) queues[c] = { cur: null, list: [], ready: null, paused: false };
  return {
    id, faction, color: FACTIONS[faction].color, isAI, startIdx,
    credits: START_CREDITS, incomeMult: 1, queues,
    powerProd: 0, powerUse: 0, lowPower: false,
    bcount: {}, explored: new Uint8Array(N), visible: new Uint8Array(N),
    defeated: false, lastAttackWarn: -99, ai: null
  };
}

function refreshPlayerStats() {
  for (const p of G.players) { p.bcount = {}; p.powerProd = 0; p.powerUse = 0; }
  for (const e of G.entities) {
    if (!e.alive || e.kind !== 'bld') continue;
    const p = G.players[e.owner];
    p.bcount[e.type] = (p.bcount[e.type] || 0) + 1;
    const pw = e.def.power;
    if (pw > 0) p.powerProd += pw * (e.hp / e.maxHp > 0.5 ? 1 : 0.6);
    else p.powerUse -= pw;
  }
  for (const p of G.players) {
    const was = p.lowPower;
    p.lowPower = p.powerUse > p.powerProd;
    if (!was && p.lowPower && p.id === G.human) eva('電力不足');
  }
}

function reqMet(p, type) {
  const d = getDef(type);
  return d.req.every(r => p.bcount[r] > 0);
}
function canBuildType(p, type) {
  const d = getDef(type);
  if (d.buildable === false) return false;
  if (d.faction && d.faction !== p.faction) return false;
  if (d.unique) {
    if (p.bcount[type]) return false;
    const q = p.queues[d.cat];
    if ((q.cur && q.cur.type === type) || q.ready === type) return true;
  }
  return reqMet(p, type);
}
function typesFor(p, cat) {
  const list = [];
  for (const [k, d] of Object.entries(BUILDINGS)) if (d.cat === cat && d.buildable !== false && (!d.faction || d.faction === p.faction)) list.push(k);
  for (const [k, d] of Object.entries(UNITS)) if (d.cat === cat && (!d.faction || d.faction === p.faction)) list.push(k);
  return list;
}

// ===== 生產 =====
function queueItem(p, type) {
  if (!canBuildType(p, type)) return false;
  const d = getDef(type), q = p.queues[d.cat];
  if (isBuildingType(type)) {
    if (q.cur || q.ready) { if (p.id === G.human) eva('正在建造其他建築', false); return false; }
    q.cur = { type, spent: 0 };
  } else {
    if (q.list.length >= 15) return false;
    q.list.push(type);
  }
  if (p.id === G.human) { sfx('click'); if (isBuildingType(type) || q.list.length === 1 && !q.cur) eva(isBuildingType(type) ? '開始建造' : '開始訓練', false); }
  return true;
}
function cancelItem(p, type) {
  const d = getDef(type), q = p.queues[d.cat];
  if (q.ready === type) { q.ready = null; p.credits += d.cost; if (p.id === G.human) { eva('已取消', false); UI.placing = null; } return; }
  const li = q.list.lastIndexOf(type);
  if (li >= 0) { q.list.splice(li, 1); return; }
  if (q.cur && q.cur.type === type) {
    if (!q.paused && p.id === G.human) { q.paused = true; eva('暫停', false); return; }
    p.credits += q.cur.spent; q.cur = null; q.paused = false;
    if (p.id === G.human) eva('已取消', false);
  }
}
function producerCount(p, cat) {
  if (cat === 'inf') return p.bcount.barracks || 0;
  if (cat === 'veh') return p.bcount.factory || 0;
  return p.bcount.conyard || 0;
}
function updateProduction(p, dt) {
  for (const cat of CATS) {
    const q = p.queues[cat];
    const nProd = producerCount(p, cat);
    if (!q.cur && q.list.length && !q.ready) q.cur = { type: q.list.shift(), spent: 0 };
    if (!q.cur || q.paused || nProd === 0) continue;
    if (!canBuildType(p, q.cur.type)) continue;
    const d = getDef(q.cur.type);
    let t = buildTime(q.cur.type);
    if (p.lowPower) t *= 2;
    t /= Math.min(2.5, 1 + 0.5 * (nProd - 1));
    if (p.isAI) t /= p.ai.buildSpeed;
    const want = d.cost / t * dt;
    const pay = Math.min(want, d.cost - q.cur.spent, p.credits);
    if (pay <= 0 && p.credits <= 0) {
      if (p.id === G.human && G.time - (p.lastNoMoney || -99) > 10) { p.lastNoMoney = G.time; eva('資金不足'); }
      continue;
    }
    p.credits -= pay; q.cur.spent += pay;
    if (q.cur.spent >= d.cost - 0.001) {
      const type = q.cur.type; q.cur = null;
      if (isBuildingType(type)) {
        q.ready = type;
        if (p.id === G.human) { eva('建造完成'); sfx('ready'); }
      } else {
        const u = spawnUnit(p, type);
        if (!u) { p.credits += d.cost; }
        else if (p.id === G.human) { eva('單位就緒', true, 'Unit ready'); sfx('ready'); }
      }
    }
  }
}

function exitTile(b) {
  return G.map.nearestPassable(b.tx + Math.floor(b.w / 2), b.ty + b.h, 6);
}
function spawnUnit(p, type) {
  const d = UNITS[type];
  const ptype = d.cat === 'inf' ? 'barracks' : 'factory';
  const prod = G.entities.find(e => e.alive && e.kind === 'bld' && e.owner === p.id && e.type === ptype);
  if (!prod) return null;
  const t = exitTile(prod);
  if (!t) return null;
  const u = new Unit(type, p.id, t[0] + 0.5, t[1] + 0.5);
  addEntity(u);
  if (!d.harvester) {
    const r = p.rally || [t[0] + 0.5 + 1.5, t[1] + 0.5 + 1.5];
    const dest = G.map.nearestPassable(r[0], r[1], 6, (x, y) => tileHasUnit(x, y, u));
    if (dest) { u.order = { t: 'move' }; u.pathTo(dest[0] + 0.5, dest[1] + 0.5); }
  }
  return u;
}

// ===== 實體管理 =====
function addEntity(e) { G.entities.push(e); G.byId.set(e.id, e); return e; }

function tileHasUnit(x, y, except) {
  for (const e of G.entities) if (e.alive && e.kind === 'unit' && e !== except && Math.floor(e.x) === x && Math.floor(e.y) === y) return true;
  return false;
}

function canPlace(p, type, tx, ty) {
  const d = BUILDINGS[type], m = G.map;
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
    if (!m.terrainOk(x, y) || m.bld[m.idx(x, y)]) return false;
    if (p.id === G.human && !p.explored[m.idx(x, y)]) return false;
    for (const e of G.entities) if (e.alive && e.kind === 'unit' && e.owner !== p.id && Math.floor(e.x) === x && Math.floor(e.y) === y) return false;
  }
  // 需在己方建築附近
  for (const b of G.entities) {
    if (!b.alive || b.kind !== 'bld' || b.owner !== p.id) continue;
    const gx = Math.max(0, b.tx - (tx + d.w), tx - (b.tx + b.w));
    const gy = Math.max(0, b.ty - (ty + d.h), ty - (b.ty + b.h));
    if (Math.max(gx, gy) <= BUILD_RADIUS) return true;
  }
  return false;
}

function placeBuilding(p, type, tx, ty, instant) {
  const b = new Building(type, p.id, tx, ty);
  if (b.def.super && p.id !== G.human) eva('警告:偵測到敵方超級武器');
  if (instant) b.prog = 1;
  addEntity(b);
  const m = G.map;
  for (let y = ty; y < ty + b.h; y++) for (let x = tx; x < tx + b.w; x++) m.bld[m.idx(x, y)] = b.id;
  // 推開站在上面的單位
  for (const e of G.entities) {
    if (!e.alive || e.kind !== 'unit') continue;
    if (e.x >= tx && e.x < tx + b.w && e.y >= ty && e.y < ty + b.h) {
      const t = m.nearestPassable(e.x, e.y, 8);
      if (t) { e.x = t[0] + 0.5; e.y = t[1] + 0.5; e.path = []; }
    }
  }
  // 路徑經過此處的單位重新尋路
  for (const e of G.entities) if (e.alive && e.kind === 'unit' && e.path.length) e.needRepath = true;
  if (BUILDINGS[type].freeUnit) {
    const dk = refineryDock(b);
    if (dk) {
      const u = new Unit(BUILDINGS[type].freeUnit, p.id, dk[0] + 0.5, dk[1] + 0.5);
      addEntity(u);
    }
  }
  refreshPlayerStats();
  return b;
}

// 樹林砍完 / 岩石採完:變成可通行的地面,留下樹樁或碎石
function depleteTile(x, y) {
  const m = G.map, i = m.idx(x, y), wasTree = m.terrain[i] === T_TREE;
  m.res[i] = 0;
  m.terrain[i] = wasTree ? T_GRASS : T_DIRT;
  if (R.doodads) R.doodads = R.doodads.filter(d => !(Math.floor(d.x) === x && Math.floor(d.y) === y));
  if (R.doodadAt) R.doodadAt.delete(i);
  if (R.stumps && wasTree) R.stumps.push({ x: x + 0.5, y: y + 0.5, wood: true, v: m.variant[i] });
  sfx(wasTree ? 'treefall' : 'pick', x, y);
}

function refineryDock(b) { return G.map.nearestPassable(b.tx + b.w, b.ty + 1, 5); }

// 距離:目標若為建築,量到其範圍邊緣
function distTo(a, t) {
  if (t.kind === 'bld') {
    const dx = Math.max(t.tx - a.x, 0, a.x - (t.tx + t.w));
    const dy = Math.max(t.ty - a.y, 0, a.y - (t.ty + t.h));
    return Math.hypot(dx, dy);
  }
  return Math.hypot(t.x - a.x, t.y - a.y);
}

function findEnemyNear(src, r, unitsOnly) {
  let best = null, bs = 1e9;
  for (const e of G.entities) {
    if (!e.alive || !isEnemy(e.owner, src.owner)) continue;
    if (unitsOnly && e.kind !== 'unit') continue;
    const d = distTo(src, e);
    if (d > r) continue;
    let s = d;
    if (e.kind === 'bld') s += 4;
    else if (!e.weapon) s += 2;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

// ===== 傷害與戰鬥 =====
function armorOf(e) { return e.kind === 'bld' ? 'bld' : e.def.armor; }

function vetOf(e) { return VET[e && e.rank ? e.rank : 0]; }
function giveXp(a, value) {
  if (!a || a.kind !== 'unit' || !a.alive) return;
  a.xp += value;
  const r = a.xp >= a.def.cost * 3 ? 2 : a.xp >= a.def.cost ? 1 : 0;
  if (r > a.rank) {
    a.rank = r;
    if (a.owner === G.human) { eva(r === 2 ? '單位晉升為精英' : '單位晉升為老兵', false); sfx('ready'); }
  }
}

function damage(t, amount, wh, attacker) {
  if (!t.alive) return;
  t.hp -= amount * WARHEADS[wh][armorOf(t)] * (t.kind === 'unit' ? vetOf(t).armor : 1);
  t.hitT = G.time;
  const p = G.players[t.owner];
  if (p.id === G.human && G.time - p.lastAttackWarn > 20) {
    p.lastAttackWarn = G.time;
    eva(t.kind === 'bld' ? '我方基地遭受攻擊' : '我方部隊遭受攻擊');
    UI.alertAt = [t.x, t.y, G.time];
  }
  if (p.ai && attacker && attacker.alive) p.ai.onAttacked(t, attacker);
  if (t.hp <= 0) {
    if (attacker && attacker.owner !== t.owner) giveXp(attacker, t.def.cost || 500);
    kill(t); return;
  }
  // 反擊
  if (t.kind === 'unit' && t.weapon && attacker && attacker.alive && t.order.t === 'idle') {
    t.order = { t: 'attack', target: attacker, auto: true, home: [t.x, t.y] };
  }
}

function damageArea(x, y, r, dmg, wh, owner, except, attacker) {
  for (const e of G.entities) {
    if (!e.alive || e === except || e.owner === owner) continue;
    const d = e.kind === 'bld' ? distTo({ x, y }, e) : Math.hypot(e.x - x, e.y - y);
    if (d <= r) damage(e, dmg * (1 - d / r * 0.5), wh, attacker || null);
  }
}

function kill(e) {
  e.alive = false; e.hp = 0;
  const m = G.map;
  if (e.kind === 'bld') {
    for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) if (m.bld[m.idx(x, y)] === e.id) m.bld[m.idx(x, y)] = 0;
    for (let i = 0; i < e.w * e.h * 2 + 2; i++) {
      addExplosion(e.tx + Math.random() * e.w, e.ty + Math.random() * e.h, 0.7 + Math.random() * 0.8, Math.random() * 0.8);
    }
    G.effects.push({ k: 'scorch', x: e.x, y: e.y, r: (e.w + e.h) / 3, t: 0, dur: 40 });
    sfx('bigboom', e.x, e.y);
    refreshPlayerStats();
  } else {
    if (e.def.cat === 'inf') {
      G.effects.push({ k: 'corpse', x: e.x, y: e.y, c: G.players[e.owner].color, t: 0, dur: 6 });
      sfx('die', e.x, e.y);
    } else if (e.def.look.kind === 'horse') {
      G.effects.push({ k: 'hcorpse', x: e.x, y: e.y, dir: e.dir, c: G.players[e.owner].color, t: 0, dur: 8 });
      sfx('die', e.x, e.y);
    } else {
      const wood = FACTIONS[G.players[e.owner].faction].era === 'ming';
      addExplosion(e.x, e.y, wood ? 0.6 : 0.9, 0);
      G.effects.push({ k: 'wreck', x: e.x, y: e.y, dir: e.dir, L: e.def.look.L, W: e.def.look.W, t: 0, dur: 12, wood });
      sfx('boom', e.x, e.y);
    }
  }
  const si = G.sel.indexOf(e);
  if (si >= 0) G.sel.splice(si, 1);
}

function addExplosion(x, y, size, delay) {
  G.effects.push({ k: 'expl', x, y, size, t: -(delay || 0), dur: 0.7 });
  for (let i = 0; i < 6 * size; i++) {
    G.effects.push({ k: 'part', x, y, z: 2, vx: (Math.random() - 0.5) * 3 * size, vy: (Math.random() - 0.5) * 3 * size, vz: 20 + Math.random() * 40,
      c: Math.random() < 0.5 ? '#ffb030' : '#555', t: -(delay || 0), dur: 0.6 + Math.random() * 0.6 });
  }
}

function aimPoint(t) {
  if (t.kind === 'bld') return [t.x, t.y, 8];
  return [t.x, t.y, t.def.cat === 'inf' ? 4 : 5];
}

function fire(src, t, w) {
  const [mx, my, mz] = src.muzzle();
  const [ax, ay, az] = aimPoint(t);
  // 對建築時射向較近的位置
  let tx = ax, ty = ay;
  if (t.kind === 'bld') { tx = clamp(src.x, t.tx + 0.3, t.tx + t.w - 0.3); ty = clamp(src.y, t.ty + 0.3, t.ty + t.h - 0.3); }
  tx += (Math.random() - 0.5) * 0.2; ty += (Math.random() - 0.5) * 0.2;
  sfx(w.snd, src.x, src.y);
  const dmg = w.dmg * vetOf(src).dmg;
  if (w.smoke) for (let i = 0; i < 3; i++) G.effects.push({ k: 'smoke', x: mx + (Math.random() - 0.5) * 0.15, y: my + (Math.random() - 0.5) * 0.15, z: mz, t: 0, dur: 1.2 + Math.random() * 0.6, light: true });
  if (w.kind === 'melee') {
    damage(t, dmg, w.wh, src);
    G.effects.push({ k: 'slash', x: tx, y: ty, z: az, t: 0, dur: 0.25, a: Math.random() * 6 });
    return;
  }
  if (w.kind === 'volley') {
    for (let i = 0; i < w.n; i++) {
      const ex = tx + (Math.random() - 0.5) * 1.4, ey = ty + (Math.random() - 0.5) * 1.4;
      const d = Math.hypot(ex - mx, ey - my);
      G.projs.push({ k: 'missile', x0: mx, y0: my, z0: mz, x1: ex, y1: ey, z1: 0, t: -i * 0.07, dur: Math.max(0.1, d / w.speed), target: null, w, dmg, owner: src.owner, src, arc: w.arc, small: true });
    }
    return;
  }
  if (w.kind === 'laser' || w.kind === 'rail') {
    damage(t, dmg, w.wh, src);
    if (w.splash) damageArea(tx, ty, w.splash, dmg * 0.5, w.wh, src.owner, t, src);
    G.effects.push({ k: w.kind === 'laser' ? 'beam' : 'rail', x1: mx, y1: my, z1: mz, x2: tx, y2: ty, z2: az,
      w: w.width || 2, c: w.kind === 'laser' ? FACTIONS.ac.beam : FACTIONS.ep.beam, t: 0, dur: w.kind === 'laser' ? 0.3 : 0.5 });
    G.effects.push({ k: 'spark', x: tx, y: ty, z: az, c: w.kind === 'laser' ? '#ffd0d0' : '#e0f6ff', t: 0, dur: 0.25 });
    if (w.splash) addExplosion(tx, ty, 0.5, 0);
    if (w.kind === 'laser' && w.width >= 2) G.effects.push({ k: 'glow', x: mx, y: my, z: mz, c: FACTIONS.ac.beam, t: 0, dur: 0.15 });
  } else {
    const speed = w.kind === 'bullet' ? 24 : w.speed;
    const d = Math.hypot(tx - mx, ty - my);
    G.projs.push({ k: w.kind, x0: mx, y0: my, z0: mz, x1: tx, y1: ty, z1: az, t: 0, dur: Math.max(0.05, d / speed),
      target: t, w, dmg, owner: src.owner, src, c: w.color || '#ffd27a', arc: w.arc ?? (w.kind === 'missile' ? 18 : w.kind === 'shell' ? 4 : 0) });
    G.effects.push({ k: 'flash', x: mx, y: my, z: mz, t: 0, dur: 0.08 });
  }
}

function updateProjs(dt) {
  for (const p of G.projs) {
    p.t += dt;
    if (p.t > 0 && (p.k === 'missile' || p.w.firepot) && Math.random() < (p.small ? 0.3 : 0.6)) {
      const f = p.t / p.dur;
      G.effects.push({ k: 'smoke', x: p.x0 + (p.x1 - p.x0) * f, y: p.y0 + (p.y1 - p.y0) * f, z: p.z0 + (p.z1 - p.z0) * f + Math.sin(f * Math.PI) * p.arc, t: 0, dur: 0.6 });
    }
    if (p.t >= p.dur) {
      p.done = true;
      if (p.target && p.target.alive) damage(p.target, p.dmg, p.w.wh, p.src);
      if (p.w.splash) damageArea(p.x1, p.y1, p.w.splash, p.dmg * 0.5, p.w.wh, p.owner, p.target, p.src);
      if (p.k === 'bullet') G.effects.push({ k: 'spark', x: p.x1, y: p.y1, z: p.z1, c: '#ffe9a0', t: 0, dur: 0.12 });
      else if (p.k === 'arrow') G.effects.push({ k: 'part', x: p.x1, y: p.y1, z: 1, vx: 0, vy: 0, vz: 8, c: '#555', t: 0, dur: 0.25 });
      else {
        addExplosion(p.x1, p.y1, p.small ? 0.3 : p.k === 'shell' ? 0.55 : 0.45, 0); sfx('hit', p.x1, p.y1);
        if (p.w.firepot) for (let i = 0; i < 6; i++) G.effects.push({ k: 'fire', x: p.x1 + (Math.random() - 0.5) * 1.2, y: p.y1 + (Math.random() - 0.5) * 1.2, z: 0, t: -Math.random() * 1.5, dur: 0.8 });
      }
    }
  }
  G.projs = G.projs.filter(p => !p.done);
}

// ===== 單位 =====
class Unit {
  constructor(type, owner, x, y) {
    this.id = G.nextId++; this.kind = 'unit'; this.type = type; this.def = UNITS[type]; this.owner = owner;
    this.x = x; this.y = y; this.maxHp = this.hp = this.def.hp; this.alive = true;
    this.dir = Math.PI * 0.75; this.tdir = this.dir;
    this.path = []; this.dest = null; this.order = this.def.harvester ? { t: 'harvest' } : { t: 'idle' };
    this.weapon = this.def.weapon ? WEAPONS[this.def.weapon] : null;
    this.cool = Math.random() * 0.5; this.scan = Math.random() * 0.5; this.repath = 0;
    this.anim = Math.random() * 10; this.moving = false; this.stuckT = 0; this.bestD = 1e9;
    this.cargo = 0; this.hstate = 'seek'; this.htile = null; this.wait = 0; this.ref = null;
    // 明朝時代:每輛採集車輪流偏好不同資源(銀、木、銀、石),讓基地同時採集多種資源
    if (this.def.harvester) {
      const n = G.entities.filter(e => e.alive && e.owner === owner && e.kind === 'unit' && e.def.harvester).length;
      this.pref = ['silver', 'wood', 'silver', 'stone'][n % 4];
    }
    this.hitT = -99; this.xp = 0; this.rank = 0;
  }
  muzzle() {
    const L = this.def.cat === 'inf' ? 0.15 : this.def.look.L * 0.55;
    const z = this.def.cat === 'inf' ? 6 : this.def.look.H + 4;
    return [this.x + Math.cos(this.tdir) * L, this.y + Math.sin(this.tdir) * L, z];
  }
  pathTo(gx, gy) {
    this.dest = [gx, gy];
    const p = G.map.findPath(this.x, this.y, gx, gy);
    this.path = p.map(([x, y]) => [x + 0.5, y + 0.5]);
    // 最後一步若在同格,走到精確點
    if (this.path.length) {
      const last = this.path[this.path.length - 1];
      if (Math.floor(last[0]) === Math.floor(gx) && Math.floor(last[1]) === Math.floor(gy)) last[0] = gx, last[1] = gy;
    }
    this.bestD = 1e9; this.stuckT = 0; this.needRepath = false;
  }
  followPath(dt) {
    if (this.needRepath && this.dest) this.pathTo(this.dest[0], this.dest[1]);
    if (!this.path.length) { this.moving = false; return true; }
    const [wx, wy] = this.path[0];
    const dx = wx - this.x, dy = wy - this.y, d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let spd = this.def.speed;
    if (this.def.cat === 'veh') {
      this.dir = rotateTo(this.dir, ang, 5 * dt);
      const off = Math.abs(angDiff(this.dir, ang));
      spd = off > 1.1 ? 0 : spd * (1 - off * 0.6);
    } else if (d > 0.01) this.dir = ang;
    const tt = G.map.terrain[G.map.idx(Math.floor(this.x), Math.floor(this.y))];
    if (tt === T_SAND) spd *= 0.85;
    const step = spd * dt;
    this.moving = step > 0;
    this.anim += step * 6;
    if (d <= step) {
      this.x = wx; this.y = wy; this.path.shift(); this.bestD = 1e9; this.stuckT = 0;
      return !this.path.length;
    }
    const nx = this.x + dx / d * step, ny = this.y + dy / d * step;
    if (!G.map.passable(Math.floor(nx), Math.floor(ny)) && G.map.passable(Math.floor(this.x), Math.floor(this.y))) {
      if (this.dest) this.pathTo(this.dest[0], this.dest[1]); else this.path = [];
      return false;
    }
    this.x = nx; this.y = ny;
    if (d < this.bestD - 0.03) { this.bestD = d; this.stuckT = 0; }
    else {
      this.stuckT += dt;
      if (this.stuckT > 1.5) {
        if (this.path.length <= 1 && d < 1.6) { this.path = []; this.moving = false; return true; }
        if (this.dest) this.pathTo(this.dest[0], this.dest[1]);
      }
    }
    return false;
  }
  update(dt) {
    this.cool -= dt; this.scan -= dt;
    if (this.rank === 2 && this.hp < this.maxHp && G.time - this.hitT > 3) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
    if (this.def.harvester) { this.updateHarvester(dt); return; }
    const o = this.order, w = this.weapon;
    switch (o.t) {
      case 'capture':
        this.updateCapture(dt, o);
        break;
      case 'idle':
        this.moving = false;
        if (w && this.scan <= 0) {
          this.scan = 0.5;
          const e = findEnemyNear(this, this.def.sight);
          if (e) this.order = { t: 'attack', target: e, auto: true, home: [this.x, this.y] };
        }
        if (this.path.length) this.followPath(dt);
        this.tdir = rotateTo(this.tdir, this.dir, 2 * dt);
        break;
      case 'move':
        if (this.followPath(dt)) this.order = { t: 'idle' };
        this.tdir = rotateTo(this.tdir, this.dir, 4 * dt);
        break;
      case 'amove':
        if (w && this.scan <= 0) {
          this.scan = 0.4;
          const e = findEnemyNear(this, this.def.sight);
          if (e) { this.order = { t: 'attack', target: e, auto: true, resume: o }; break; }
        }
        if (this.followPath(dt)) this.order = { t: 'idle' };
        this.tdir = rotateTo(this.tdir, this.dir, 4 * dt);
        break;
      case 'attack':
        this.updateAttack(dt, o);
        break;
    }
  }
  updateCapture(dt, o) {
    const t = o.target;
    if (!t.alive || (t.owner === this.owner && t.hp >= t.maxHp)) { this.order = { t: 'idle' }; this.path = []; return; }
    if (distTo(this, t) <= 1.2) {
      if (t.owner === this.owner) {
        t.hp = t.maxHp;
        if (this.owner === G.human) eva('建築已修復');
      } else {
        const old = G.players[t.owner];
        t.owner = this.owner; t.repairing = false; t.target = null;
        if (t.def.super) t.charge = 0;
        if (this.owner === G.human) eva('建築已佔領');
        else if (old.id === G.human) eva('我方建築被佔領');
        refreshPlayerStats();
      }
      sfx('ready', t.x, t.y);
      this.alive = false; this.hp = 0;
      const si = G.sel.indexOf(this); if (si >= 0) G.sel.splice(si, 1);
      return;
    }
    this.repath -= dt;
    if (this.repath <= 0 || !this.path.length) { this.repath = 1.5; this.pathTo(t.x, t.y); }
    if (this.followPath(dt) && distTo(this, t) > 1.2) this.repath = 0.5;
  }
  endAttack(o) {
    if (o.resume) { this.order = o.resume; this.pathTo(o.resume.gx, o.resume.gy); }
    else this.order = { t: 'idle' };
    this.path = this.order.t === 'idle' ? [] : this.path;
  }
  updateAttack(dt, o) {
    const t = o.target, w = this.weapon;
    if (!w || !t.alive) { this.endAttack(o); return; }
    const d = distTo(this, t);
    if (d <= w.range) {
      this.path = []; this.moving = false;
      const ang = Math.atan2(t.y - this.y, t.x - this.x);
      let aimed;
      if (this.def.cat === 'inf') { this.dir = ang; this.tdir = ang; aimed = true; }
      else { this.tdir = rotateTo(this.tdir, ang, 5 * dt); aimed = Math.abs(angDiff(this.tdir, ang)) < 0.12; }
      if (aimed && this.cool <= 0) { fire(this, t, w); this.cool = w.rof * vetOf(this).rof * (0.9 + Math.random() * 0.2); }
    } else {
      if (o.auto && o.home && !o.resume && Math.hypot(this.x - o.home[0], this.y - o.home[1]) > 7) {
        this.order = { t: 'move' }; this.pathTo(o.home[0], o.home[1]); return;
      }
      if (o.auto && d > this.def.sight + 3) { this.endAttack(o); return; }
      this.repath -= dt;
      if (this.repath <= 0 || !this.path.length) { this.repath = 1.0; this.pathTo(t.x, t.y); }
      this.followPath(dt);
      this.tdir = rotateTo(this.tdir, this.dir, 4 * dt);
    }
  }
  updateHarvester(dt) {
    const o = this.order, m = G.map;
    if (o.t === 'move') {
      if (this.followPath(dt)) { this.order = { t: 'harvest' }; this.hstate = 'seek'; }
      return;
    }
    switch (this.hstate) {
      case 'seek': {
        this.moving = false;
        this.wait -= dt; if (this.wait > 0) return;
        if (this.cargo >= HARV_CAP) { this.hstate = 'toRef'; this.ref = null; return; }
        const tile = this.findOre();
        if (!tile) { this.wait = 3; if (this.cargo > 0) { this.hstate = 'toRef'; this.ref = null; } return; }
        this.htile = tile; this.pathTo(tile[0] + 0.5, tile[1] + 0.5); this.hstate = 'toOre';
        break;
      }
      case 'toOre':
        if (this.followPath(dt)) {
          const tx = Math.floor(this.x), ty = Math.floor(this.y);
          const h = this.htile;
          if (h && m.gatherKind(h[0], h[1]) && Math.max(Math.abs(h[0] - tx), Math.abs(h[1] - ty)) <= 1) this.hstate = 'harvest';
          else if (m.ore[m.idx(tx, ty)] > 5) { this.htile = [tx, ty]; this.hstate = 'harvest'; }
          else { this.hstate = 'seek'; this.wait = 0.3; if (h) this.skip = h[0] + h[1] * MAP_W; }
        }
        break;
      case 'harvest': {
        this.moving = false;
        const i = m.idx(this.htile[0], this.htile[1]);
        const gk = m.gatherKind(this.htile[0], this.htile[1]);
        if (gk) {
          // 砍樹 / 採石
          const R0 = GATHER[gk];
          this.dir = rotateTo(this.dir, Math.atan2(this.htile[1] + 0.5 - this.y, this.htile[0] + 0.5 - this.x), 4 * dt);
          const take = Math.min(R0.rate * dt, m.res[i], (HARV_CAP - this.cargo) / R0.value);
          m.res[i] -= take; this.cargo += take * R0.value; this.cargoKind = gk;
          this.anim += dt * 8;
          if (Math.random() < dt * 6) {
            G.effects.push({ k: 'part', x: this.htile[0] + 0.5 + (Math.random() - 0.5) * 0.4, y: this.htile[1] + 0.5 + (Math.random() - 0.5) * 0.4, z: gk === 'wood' ? 6 : 3,
              vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, vz: 15 + Math.random() * 20, c: gk === 'wood' ? '#8a6440' : '#555', t: 0, dur: 0.5 });
            const dd = R.doodadAt && R.doodadAt.get(i); if (dd) dd.hitT = G.time;
            sfx(gk === 'wood' ? 'chop' : 'pick', this.x, this.y);
          }
          if (m.res[i] <= 0.5) depleteTile(this.htile[0], this.htile[1]);
          if (this.cargo >= HARV_CAP - 0.5) { this.hstate = 'toRef'; this.ref = null; }
          else if (m.res[i] <= 0.5) this.hstate = 'seek';
          break;
        }
        if (m.ore[i] < 1) { this.hstate = 'seek'; break; }
        this.cargoKind = G.era === 'ming' ? 'silver' : 'ore';
        const mult = m.oreType[i] === 2 ? 2 : 1;
        const take = Math.min(HARV_RATE * dt, m.ore[i], (HARV_CAP - this.cargo) / mult);
        m.ore[i] -= take; this.cargo += take * mult;
        this.anim += dt * 8;
        if (this.cargo >= HARV_CAP - 0.5) { this.hstate = 'toRef'; this.ref = null; }
        else if (m.ore[i] < 1) { this.hstate = 'seek'; }
        break;
      }
      case 'toRef': {
        if (!this.ref || !this.ref.alive) {
          let best = null, bd = 1e9;
          for (const e of G.entities) if (e.alive && e.kind === 'bld' && e.type === 'refinery' && e.owner === this.owner) {
            const d = dist(this.x, this.y, e.x, e.y); if (d < bd) { bd = d; best = e; }
          }
          if (!best) { this.moving = false; this.wait = 2; this.hstate = 'seek'; return; }
          this.ref = best;
          const dk = refineryDock(best);
          if (!dk) return;
          this.dock = dk; this.pathTo(dk[0] + 0.5, dk[1] + 0.5);
        }
        if (this.followPath(dt)) {
          if (dist(this.x, this.y, this.dock[0] + 0.5, this.dock[1] + 0.5) < 0.9) this.hstate = 'unload';
          else this.pathTo(this.dock[0] + 0.5, this.dock[1] + 0.5);
        }
        break;
      }
      case 'unload': {
        this.moving = false;
        if (!this.ref || !this.ref.alive) { this.hstate = 'toRef'; this.ref = null; return; }
        this.dir = rotateTo(this.dir, Math.PI, 3 * dt);
        const p = G.players[this.owner];
        const amt = Math.min(UNLOAD_RATE * dt, this.cargo);
        this.cargo -= amt; p.credits += amt * p.incomeMult;
        if (this.cargo <= 0.01) { this.cargo = 0; this.hstate = 'seek'; }
        break;
      }
    }
  }
  findOre() {
    const m = G.map;
    let best = null, bs = 1e9;
    const gatherEra = ERAS[G.era] && ERAS[G.era].gather;
    const ox = this.htile ? this.htile[0] : this.x, oy = this.htile ? this.htile[1] : this.y;
    const claimed = new Set();
    for (const e of G.entities) if (e !== this && e.alive && e.kind === 'unit' && e.def.harvester && e.htile && (e.hstate === 'toOre' || e.hstate === 'harvest')) claimed.add(e.htile[0] + e.htile[1] * MAP_W);
    for (let i = 0; i < m.ore.length; i++) {
      if (m.ore[i] < 30 || m.bld[i]) continue;
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      let s = dist(ox, oy, x, y) + (claimed.has(i) ? 6 : 0) + (gatherEra && this.pref && this.pref !== 'silver' ? 8 : 0);
      if (s < bs) { bs = s; best = [x, y]; }
    }
    // 明朝時代:樹林與岩石也可採集(稍微偏好銀礦)
    if (gatherEra) {
      for (let i = 0; i < m.res.length; i++) {
        if (m.res[i] <= 0 || i === this.skip) continue;
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        const kind = m.terrain[i] === T_TREE ? 'wood' : 'stone';
        const pen = kind === this.pref ? 0 : 8;
        const d0 = dist(ox, oy, x, y);
        if (d0 + pen >= bs) continue;
        if (!m.reachableEdge(x, y)) continue;
        const s = d0 + pen + (claimed.has(i) ? 4 : 0);
        if (s < bs) { bs = s; best = [x, y]; }
      }
    }
    this.skip = -1;
    return best;
  }
}

// ===== 建築 =====
class Building {
  constructor(type, owner, tx, ty) {
    this.id = G.nextId++; this.kind = 'bld'; this.type = type; this.def = BUILDINGS[type]; this.owner = owner;
    this.tx = tx; this.ty = ty; this.w = this.def.w; this.h = this.def.h;
    this.x = tx + this.w / 2; this.y = ty + this.h / 2;
    this.maxHp = this.hp = this.def.hp; this.alive = true; this.prog = 0;
    this.weapon = this.def.weapon ? WEAPONS[this.def.weapon] : null;
    this.tdir = Math.PI * 0.75; this.cool = 0; this.scan = 0; this.target = null;
    this.repairing = false; this.hitT = -99; this.anim = Math.random() * 10;
    this.charge = 0;
  }
  muzzle() { return [this.x + Math.cos(this.tdir) * 0.35, this.y + Math.sin(this.tdir) * 0.35, 16]; }
  update(dt) {
    this.anim += dt;
    if (this.prog < 1) { this.prog = Math.min(1, this.prog + dt / 1.5); return; }
    const p = G.players[this.owner];
    if (this.repairing) {
      if (this.hp >= this.maxHp) this.repairing = false;
      else {
        const heal = Math.min(this.maxHp * 0.04 * dt, this.maxHp - this.hp);
        const cost = heal * this.def.cost / this.maxHp * 0.25;
        if (p.credits >= cost) { p.credits -= cost; this.hp += heal; }
        if (Math.random() < dt * 3) G.effects.push({ k: 'spark', x: this.tx + Math.random() * this.w, y: this.ty + Math.random() * this.h, z: 10 + Math.random() * 8, c: '#7fff7f', t: 0, dur: 0.3 });
      }
    }
    if (this.def.super) {
      const was = this.charge >= this.def.charge;
      if (!p.lowPower) this.charge = Math.min(this.def.charge, this.charge + dt);
      if (!was && this.charge >= this.def.charge) {
        if (p.id === G.human) eva('超級武器已就緒');
        else eva('警告:敵方超級武器已就緒');
      }
    }
    const w = this.weapon;
    if (!w || p.lowPower) return;
    this.cool -= dt; this.scan -= dt;
    if (this.target && (!this.target.alive || distTo(this, this.target) > w.range)) this.target = null;
    if (!this.target && this.scan <= 0) { this.scan = 0.4; this.target = findEnemyNear(this, w.range, true) || findEnemyNear(this, w.range); }
    if (this.target) {
      const t = this.target;
      const ang = Math.atan2(t.y - this.y, t.x - this.x);
      this.tdir = rotateTo(this.tdir, ang, 4 * dt);
      if (Math.abs(angDiff(this.tdir, ang)) < 0.1 && this.cool <= 0) { fire(this, t, w); this.cool = w.rof; }
    }
  }
}

// ===== 指令 =====
function spreadDest(x, y, n) {
  const m = G.map, out = [];
  const sx = clamp(Math.floor(x), 0, MAP_W - 1), sy = clamp(Math.floor(y), 0, MAP_H - 1);
  const start = m.nearestPassable(sx, sy, 10);
  if (!start) return [];
  const seen = new Set([start[0] + start[1] * MAP_W]);
  const q = [start];
  while (q.length && out.length < n) {
    const c = q.shift();
    out.push(c);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = c[0] + dx, ny = c[1] + dy, k = nx + ny * MAP_W;
      if (!seen.has(k) && m.passable(nx, ny)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return out;
}

function cmdMove(units, x, y, attackMove) {
  if (!units.length) return;
  // 依與目標距離排序,讓近的單位分配到靠中心的位置
  const us = units.slice().sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  const dests = spreadDest(x, y, us.length);
  us.forEach((u, i) => {
    const d = dests[i] || dests[0];
    if (!d) return;
    const gx = us.length === 1 ? x : d[0] + 0.5, gy = us.length === 1 ? y : d[1] + 0.5;
    u.order = { t: attackMove && u.weapon ? 'amove' : 'move', gx, gy };
    u.pathTo(gx, gy);
  });
}

function cmdAttack(units, target) {
  for (const u of units) {
    if (!u.weapon) continue;
    u.order = { t: 'attack', target, auto: false };
    u.repath = 0;
  }
}

function cmdCapture(units, target) {
  for (const u of units) { u.order = { t: 'capture', target }; u.repath = 0; }
}

// ===== 超級武器 =====
function fireSuper(b, x, y) {
  if (!b.alive || b.charge < b.def.charge) return false;
  b.charge = 0;
  const kind = b.def.super, owner = b.owner;
  if (owner === G.human) eva(`${b.def.name}已發動`);
  else eva(`警告:敵方${b.def.name}已發動`);
  if (kind === 'orbital') {
    G.strikes.push({ k: 'orbital', vis: b.def.vis, x, y, cx: x, cy: y, owner, t: 0, dur: 4.5, tick: 0 });
    sfx('laserB', x, y);
  } else {
    G.strikes.push({ k: 'missile', vis: b.def.vis, x, y, owner, t: 0, dur: 3, sx: b.x, sy: b.y });
    sfx('rocket', b.x, b.y);
  }
  if (owner !== G.human) UI.alertAt = [x, y, G.time];
  // 目標區域短暫可見
  G.reveals.push({ x, y, owner, until: G.time + 8 });
  return true;
}
function updateStrikes(dt) {
  for (const s of G.strikes) {
    s.t += dt;
    if (s.k === 'orbital') {
      if (s.t > 1) {
        s.tick -= dt;
        s.cx = s.x + Math.sin(s.t * 1.7) * 0.6; s.cy = s.y + Math.cos(s.t * 1.3) * 0.6;
        if (s.tick <= 0) {
          s.tick = 0.2;
          damageArea(s.cx, s.cy, 2.6, 42, 'siege', s.owner);
          addExplosion(s.cx + (Math.random() - 0.5) * 2.5, s.cy + (Math.random() - 0.5) * 2.5, 0.8, 0);
          if (Math.random() < 0.4) sfx('boom', s.cx, s.cy);
          G.effects.push({ k: 'scorch', x: s.cx, y: s.cy, r: 1.2, t: 0, dur: 30 });
        }
      }
    } else if (s.t >= s.dur && !s.done) {
      s.done = true;
      damageArea(s.x, s.y, 3.2, 640, 'siege', s.owner);
      for (let i = 0; i < 14; i++) addExplosion(s.x + (Math.random() - 0.5) * 5, s.y + (Math.random() - 0.5) * 5, 1 + Math.random(), Math.random() * 0.6);
      G.effects.push({ k: 'shock', x: s.x, y: s.y, t: 0, dur: 0.8 });
      G.effects.push({ k: 'scorch', x: s.x, y: s.y, r: 3, t: 0, dur: 60 });
      sfx('bigboom', s.x, s.y);
    }
  }
  G.strikes = G.strikes.filter(s => s.t < s.dur);
  G.reveals = G.reveals.filter(r => r.until > G.time);
}

function cmdStop(units) {
  for (const u of units) { u.path = []; u.order = u.def.harvester ? { t: 'harvest' } : { t: 'idle' }; if (u.def.harvester) u.hstate = 'seek'; }
}

function sellBuilding(b) {
  if (!b.alive || b.kind !== 'bld') return;
  const p = G.players[b.owner];
  p.credits += Math.floor(b.def.cost * 0.5 * b.hp / b.maxHp);
  b.alive = false;
  const m = G.map;
  for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) m.bld[m.idx(x, y)] = 0;
  // 退回部分步兵
  const n = Math.min(3, Math.floor(b.def.cost / 600));
  const infType = p.faction + '_inf';
  for (let i = 0; i < n; i++) {
    const t = m.nearestPassable(b.x, b.y, 6, (x, y) => tileHasUnit(x, y));
    if (t) addEntity(new Unit(infType, p.id, t[0] + 0.5, t[1] + 0.5));
  }
  const si = G.sel.indexOf(b); if (si >= 0) G.sel.splice(si, 1);
  refreshPlayerStats();
  if (p.id === G.human) { eva('建築已出售'); sfx('sell'); }
}

// ===== 每幀更新 =====
let _statT = 0, _fogT = 0, _oreT = 0, _endT = 0;
function updateGame(dt) {
  G.time += dt;
  _statT -= dt;
  if (_statT <= 0) { _statT = 0.5; refreshPlayerStats(); }
  for (const p of G.players) { if (!p.defeated) updateProduction(p, dt); if (p.ai) p.ai.update(dt); }
  for (const e of G.entities) if (e.alive) e.update(dt);
  separate(dt);
  updateProjs(dt);
  updateStrikes(dt);
  for (const f of G.effects) {
    f.t += dt;
    if (f.k === 'part' && f.t > 0) { f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vz -= 120 * dt; if (f.z < 0) { f.z = 0; f.vz *= -0.3; } }
    if (f.k === 'smoke') f.z += 10 * dt;
  }
  G.effects = G.effects.filter(f => f.t < f.dur);
  if (G.entities.some(e => !e.alive)) {
    G.entities = G.entities.filter(e => e.alive);
    G.byId = new Map(G.entities.map(e => [e.id, e]));
  }
  // 礦物再生
  _oreT -= dt;
  if (_oreT <= 0) {
    _oreT = 2;
    const m = G.map;
    for (let i = 0; i < m.ore.length; i++) if (m.oreType[i] && m.ore[i] < m.oreMax[i]) m.ore[i] = Math.min(m.oreMax[i], m.ore[i] + 3);
  }
  _fogT -= dt;
  if (_fogT <= 0) { _fogT = 0.25; updateFog(me()); }
  _endT -= dt;
  if (_endT <= 0) { _endT = 1; checkEnd(); }
}

function separate(dt) {
  const us = G.entities.filter(e => e.alive && e.kind === 'unit');
  const m = G.map;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    if (a.def.harvester && (a.hstate === 'unload' || a.hstate === 'harvest')) continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 0.7 || Math.abs(dy) > 0.7) continue;
      if (b.def.harvester && (b.hstate === 'unload' || b.hstate === 'harvest')) continue;
      const ra = a.def.cat === 'inf' ? 0.18 : 0.38, rb = b.def.cat === 'inf' ? 0.18 : 0.38;
      const d = Math.hypot(dx, dy) || 0.01, min = ra + rb;
      if (d >= min) continue;
      const push = Math.min((min - d) * 0.5, 2 * dt);
      const nx = dx / d * push, ny = dy / d * push;
      // 移動中的單位較不會被推開
      const wa = a.moving && !b.moving ? 0.25 : 0.5, wb = 1 - wa;
      const ax = a.x - nx * wa * 2, ay = a.y - ny * wa * 2, bx = b.x + nx * wb * 2, by = b.y + ny * wb * 2;
      if (m.passable(Math.floor(ax), Math.floor(ay))) { a.x = ax; a.y = ay; }
      if (m.passable(Math.floor(bx), Math.floor(by))) { b.x = bx; b.y = by; }
    }
  }
}

function updateFog(p) {
  const vis = p.visible;
  vis.fill(0);
  for (const e of G.entities) {
    if (!e.alive || e.owner !== p.id) continue;
    const r = e.def.sight + (e.kind === 'bld' ? Math.max(e.w, e.h) / 2 : 0);
    const cx = e.x, cy = e.y;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(MAP_W - 1, Math.floor(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(MAP_H - 1, Math.floor(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) { const i = y * MAP_W + x; vis[i] = 1; p.explored[i] = 1; }
    }
  }
  for (const r of G.reveals) {
    if (r.owner !== p.id) continue;
    for (let y = Math.max(0, Math.floor(r.y - 4)); y <= Math.min(MAP_H - 1, r.y + 4); y++)
      for (let x = Math.max(0, Math.floor(r.x - 4)); x <= Math.min(MAP_W - 1, r.x + 4); x++) {
        if (Math.hypot(x + 0.5 - r.x, y + 0.5 - r.y) <= 4) { vis[y * MAP_W + x] = 1; p.explored[y * MAP_W + x] = 1; }
      }
  }
}
function isVisible(e) {
  const p = me();
  if (e.owner === p.id) return true;
  if (e.kind === 'bld') {
    for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) if (p.explored[y * MAP_W + x]) return true;
    return false;
  }
  const x = Math.floor(e.x), y = Math.floor(e.y);
  return G.map.inb(x, y) && p.visible[y * MAP_W + x] === 1;
}

function checkEnd() {
  if (G.over) return;
  for (const p of G.players) {
    if (p.defeated) continue;
    const alive = G.entities.some(e => e.alive && e.owner === p.id && e.kind === 'bld');
    if (!alive) p.defeated = true;
  }
  if (me().defeated) endGame(false);
  else if (G.players.every(p => p.id === G.human || p.defeated)) endGame(true);
}

// ===== 新遊戲 =====
function newGame(opts) {
  const seed = opts.seed || (Math.random() * 1e9) | 0;
  G.era = ERAS[opts.era] ? opts.era : '2050';
  const era = ERAS[G.era];
  G.map = new GameMap(seed, era.players, { rockClusters: !!era.gather });
  G.entities = []; G.byId = new Map(); G.nextId = 1; G.effects = []; G.projs = []; G.strikes = []; G.reveals = [];
  G.time = 0; G.over = false; G.sel = []; G.groups = {}; G.difficulty = opts.difficulty;
  const fac = era.factions.includes(opts.faction) ? opts.faction : era.factions[0];
  const facs = [fac].concat(era.factions.filter(f => f !== fac));
  // 隨機分配起始位置
  const idx = facs.map((_, i) => i), rr = mulberry32(seed ^ 0x5bd1);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  G.players = facs.map((f, i) => makePlayer(i, f, i > 0, idx[i]));
  G.human = 0;
  const human = G.players[0];
  for (const p of G.players) if (p.isAI) p.ai = new AI(p, opts.difficulty);
  for (const p of G.players) {
    const s = G.map.starts[p.startIdx];
    placeBuilding(p, 'conyard', s.x, s.y, true);
    const cx = s.x + 1.5, cy = s.y + 1.5;
    const vx = MAP_W / 2 - cx, vy = MAP_H / 2 - cy, l = Math.hypot(vx, vy);
    const spawn = [[p.faction + '_inf', 0], [p.faction + '_inf', 1], [p.faction + '_inf', 2], [p.faction + '_light', 3]];
    const dests = spreadDest(cx + vx / l * 4, cy + vy / l * 4, spawn.length);
    spawn.forEach(([t], i) => { if (dests[i]) addEntity(new Unit(t, p.id, dests[i][0] + 0.5, dests[i][1] + 0.5)); });
  }
  refreshPlayerStats();
  updateFog(human);
  const s = G.map.starts[human.startIdx];
  centerCamera(s.x + 1.5, s.y + 1.5);
}
