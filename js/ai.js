'use strict';
// ===== 電腦對手 =====
const AI_CFG = {
  easy:   { income: 0.75, build: 0.75, wave: 5,  interval: 170, first: 330, turrets: 1, harvPerRef: 1 },
  normal: { income: 1.0,  build: 1.0,  wave: 7,  interval: 130, first: 260, turrets: 2, harvPerRef: 2 },
  hard:   { income: 1.3,  build: 1.35, wave: 9,  interval: 95,  first: 190, turrets: 4, harvPerRef: 2 }
};
const AI_ORDER = ['power', 'refinery', 'barracks', 'power', 'factory', 'refinery', 'power', 'tech', 'power', 'barracks', 'factory', 'power'];

class AI {
  constructor(p, diff) {
    this.p = p; this.cfg = AI_CFG[diff] || AI_CFG.normal;
    p.incomeMult = this.cfg.income; this.buildSpeed = this.cfg.build;
    this.think = 1; this.nextAttack = this.cfg.first; this.waveSize = this.cfg.wave;
    this.lastDefend = -99; this.attackers = new Set();
  }
  get enemy() { return G.players.find(q => q.id !== this.p.id); }
  baseCenter() {
    const c = G.entities.find(e => e.alive && e.owner === this.p.id && e.type === 'conyard')
      || G.entities.find(e => e.alive && e.owner === this.p.id && e.kind === 'bld');
    if (c) return [c.x, c.y];
    const s = G.map.starts[this.p.startIdx]; return [s.x + 1.5, s.y + 1.5];
  }
  update(dt) {
    if (this.p.defeated) return;
    this.think -= dt;
    if (this.think > 0) return;
    this.think = 0.8;
    const p = this.p;
    const [cx, cy] = this.baseCenter();
    if (!p.rally) {
      const vx = MAP_W / 2 - cx, vy = MAP_H / 2 - cy, l = Math.hypot(vx, vy) || 1;
      p.rally = [cx + vx / l * 6, cy + vy / l * 6];
    }

    // 1. 放置完成的建築
    for (const cat of ['bld', 'def']) {
      const q = p.queues[cat];
      if (q.ready) {
        const spot = this.findSpot(q.ready);
        if (spot) { placeBuilding(p, q.ready, spot[0], spot[1]); q.ready = null; }
        else { p.credits += getDef(q.ready).cost; q.ready = null; }
      }
    }

    // 2. 建造順序
    const qb = p.queues.bld;
    if (!qb.cur && !qb.ready && p.bcount.conyard) {
      let next = null;
      if (p.powerProd - p.powerUse < 25 && (p.bcount.power || 0) > 0) next = 'power';
      else {
        const need = {};
        for (const t of AI_ORDER) {
          need[t] = (need[t] || 0) + 1;
          if ((p.bcount[t] || 0) < need[t] && canBuildType(p, t)) { next = t; break; }
        }
      }
      if (next && p.credits > 200) queueItem(p, next);
    }

    // 3. 防禦塔
    const qd = p.queues.def;
    const turretType = p.faction + '_turret';
    const wantTurrets = Math.min(8, Math.floor(this.cfg.turrets * (1 + G.time / 500)));
    if (!qd.cur && !qd.ready && canBuildType(p, turretType) && (p.bcount[turretType] || 0) < wantTurrets && p.credits > 1200 && p.bcount.factory)
      queueItem(p, turretType);

    // 3b. 超級武器
    const superType = p.faction + '_super';
    if (!qd.cur && !qd.ready && canBuildType(p, superType) && G.time > 420)
      queueItem(p, superType);
    const sw = G.entities.find(e => e.alive && e.owner === p.id && e.def.super && e.prog >= 1);
    if (sw && sw.charge >= sw.def.charge) {
      const t = this.superTarget();
      if (t) fireSuper(sw, t[0], t[1]);
    }

    // 4. 生產單位
    const units = G.entities.filter(e => e.alive && e.owner === p.id && e.kind === 'unit');
    const harv = units.filter(u => u.def.harvester).length;
    const qv = p.queues.veh, qi = p.queues.inf;
    const harvQueued = qv.list.includes('harvester') || (qv.cur && qv.cur.type === 'harvester');
    const wantHarv = Math.min(6, (p.bcount.refinery || 0) * this.cfg.harvPerRef);
    if (harv < wantHarv && !harvQueued && canBuildType(p, 'harvester')) qv.list.unshift('harvester');
    const saving = qd.cur && getDef(qd.cur.type).super;
    if (qi.list.length < 2 && p.credits > 300 && !saving) {
      const opts = typesFor(p, 'inf').filter(t => canBuildType(p, t) && !UNITS[t].engineer);
      if (opts.length) queueItem(p, Math.random() < 0.55 ? opts[0] : opts[opts.length - 1]);
    }
    if (qv.list.length < 2 && p.credits > 700 && !saving) {
      const f = p.faction, r = Math.random();
      let t = r < 0.5 ? f + '_tank' : r < 0.75 ? f + '_light' : f + '_art';
      if (!canBuildType(p, t)) t = f + '_tank';
      if (canBuildType(p, t)) queueItem(p, t);
    }

    // 5. 部隊指揮
    const army = units.filter(u => u.weapon);
    const idle = army.filter(u => u.order.t === 'idle' || (u.order.t === 'move' && !u.path.length));
    // 防守
    const myB = G.entities.filter(e => e.alive && e.owner === p.id && e.kind === 'bld');
    let threat = null;
    for (const e of G.entities) {
      if (!e.alive || e.owner === p.id || e.kind !== 'unit') continue;
      if (myB.some(b => dist(b.x, b.y, e.x, e.y) < 11)) { threat = e; break; }
    }
    if (threat && G.time - this.lastDefend > 4) {
      this.lastDefend = G.time;
      const def = army.filter(u => dist(u.x, u.y, cx, cy) < 20 && u.order.t !== 'attack');
      cmdMove(def, threat.x, threat.y, true);
    }
    // 集結
    for (const u of idle) {
      if (dist(u.x, u.y, cx, cy) < 12 && dist(u.x, u.y, p.rally[0], p.rally[1]) > 4) {
        const d = G.map.nearestPassable(p.rally[0] + (Math.random() - 0.5) * 4, p.rally[1] + (Math.random() - 0.5) * 4, 5);
        if (d) { u.order = { t: 'move' }; u.pathTo(d[0] + 0.5, d[1] + 0.5); }
      }
    }
    // 進攻
    if (G.time > this.nextAttack && !threat) {
      const ready = army.filter(u => u.order.t === 'idle' || u.order.t === 'move');
      if (ready.length >= this.waveSize) {
        const target = this.pickTarget(cx, cy);
        if (target) {
          cmdMove(ready, target.x, target.y, true);
          this.nextAttack = G.time + this.cfg.interval;
          this.waveSize = Math.min(24, this.waveSize + 2);
        }
      }
    }
  }
  // 找敵方建築最密集處
  superTarget() {
    const eb = G.entities.filter(e => e.alive && e.owner !== this.p.id && e.kind === 'bld');
    let best = null, bs = -1;
    for (const b of eb) {
      let s = 0;
      for (const o of eb) if (dist(b.x, b.y, o.x, o.y) < 3.5) s += o.def.cost;
      if (s > bs) { bs = s; best = [b.x, b.y]; }
    }
    return best;
  }
  pickTarget(cx, cy) {
    const eb = G.entities.filter(e => e.alive && e.owner !== this.p.id && e.kind === 'bld');
    if (!eb.length) return null;
    // 偏好電廠與精煉廠,其次最近的建築
    eb.sort((a, b) => {
      const sa = dist(a.x, a.y, cx, cy) - (a.type === 'refinery' || a.type === 'power' ? 6 : 0);
      const sb = dist(b.x, b.y, cx, cy) - (b.type === 'refinery' || b.type === 'power' ? 6 : 0);
      return sa - sb;
    });
    return eb[Math.floor(Math.random() * Math.min(3, eb.length))];
  }
  onAttacked(t, attacker) {
    if (G.time - this.lastDefend < 3) return;
    this.lastDefend = G.time;
    const army = G.entities.filter(e => e.alive && e.owner === this.p.id && e.kind === 'unit' && e.weapon &&
      e.order.t !== 'attack' && dist(e.x, e.y, t.x, t.y) < 14);
    cmdAttack(army, attacker);
  }
  findSpot(type) {
    const p = this.p, d = BUILDINGS[type], m = G.map;
    const [cx, cy] = this.baseCenter();
    let es = null, ed = 1e9;
    for (const q of G.players) {
      if (q.id === p.id || q.defeated) continue;
      const s = G.map.starts[q.startIdx], d = dist(s.x, s.y, cx, cy);
      if (d < ed) { ed = d; es = s; }
    }
    if (!es) es = { x: MAP_W / 2, y: MAP_H / 2 };
    let best = null, bs = 1e9;
    for (let ty = Math.floor(cy) - 12; ty <= cy + 12; ty++) for (let tx = Math.floor(cx) - 12; tx <= cx + 12; tx++) {
      if (!canPlace(p, type, tx, ty)) continue;
      // 四周保留一格通道
      let ok = true, oreTiles = 0;
      for (let y = ty - 1; y <= ty + d.h && ok; y++) for (let x = tx - 1; x <= tx + d.w; x++) {
        if (m.inb(x, y) && m.bld[m.idx(x, y)]) { ok = false; break; }
        if (m.inb(x, y) && m.oreType[m.idx(x, y)]) oreTiles++;
      }
      if (!ok) continue;
      const mx = tx + d.w / 2, my = ty + d.h / 2;
      let s = dist(mx, my, cx, cy) + oreTiles * 1.5 + Math.random() * 1.5;
      if (type === 'refinery') {
        let od = 1e9;
        for (const f of m.oreFields) od = Math.min(od, dist(mx, my, f.x, f.y));
        s += od * 1.2;
      }
      if (d.cat === 'def' && !d.super) {
        const de = dist(mx, my, es.x, es.y);
        s = Math.abs(dist(mx, my, cx, cy) - 6) * 2 + de * 0.3 + Math.random() * 3;
      }
      if (s < bs) { bs = s; best = [tx, ty]; }
    }
    return best;
  }
}
