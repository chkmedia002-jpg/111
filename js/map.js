'use strict';
// ===== 地圖生成與尋路 =====
const T_GRASS = 0, T_SAND = 1, T_WATER = 2, T_ROCK = 3, T_TREE = 4, T_DIRT = 5;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeNoise(rng, cell) {
  const gw = Math.ceil(MAP_W / cell) + 2, gh = Math.ceil(MAP_H / cell) + 2;
  const g = new Float32Array(gw * gh).map(() => rng());
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

class GameMap {
  constructor(seed) {
    this.w = MAP_W; this.h = MAP_H;
    const n = MAP_W * MAP_H;
    this.terrain = new Uint8Array(n);
    this.ore = new Float32Array(n);
    this.oreMax = new Float32Array(n);
    this.oreType = new Uint8Array(n);   // 0 無, 1 稀土, 2 藍晶
    this.variant = new Uint8Array(n);
    this.bld = new Int32Array(n);       // 建築佔用 (entity id)
    this.oreFields = [];
    this.generate(seed);
  }
  idx(x, y) { return y * MAP_W + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  terrainOk(x, y) {
    if (!this.inb(x, y)) return false;
    const t = this.terrain[y * MAP_W + x];
    return t !== T_WATER && t !== T_ROCK && t !== T_TREE;
  }
  passable(x, y) { return this.terrainOk(x, y) && this.bld[y * MAP_W + x] === 0; }

  generate(seed) {
    const rng = mulberry32(seed);
    this.rng = rng;
    const nA = makeNoise(rng, 9), nB = makeNoise(rng, 11), nC = makeNoise(rng, 6), nD = makeNoise(rng, 5), nE = makeNoise(rng, 4);
    this.starts = [{ x: 6, y: MAP_H - 10 }, { x: MAP_W - 10, y: 6 }];
    const sc = this.starts.map(s => ({ x: s.x + 1.5, y: s.y + 1.5 }));
    const near = (x, y, r) => sc.some(s => Math.hypot(x - s.x, y - s.y) < r);

    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const i = this.idx(x, y);
      let t = T_GRASS;
      if (nA(x, y) > 0.62) t = T_SAND; else if (nC(x, y) > 0.7) t = T_DIRT;
      if (nB(x, y) > 0.68 && !near(x, y, 14)) t = T_WATER;
      else if (nD(x, y) > 0.78 && !near(x, y, 10)) t = T_ROCK;
      else if (t === T_GRASS && !near(x, y, 9) && rng() < (nE(x, y) > 0.6 ? 0.45 : 0.03)) t = T_TREE;
      this.terrain[i] = t;
      this.variant[i] = (rng() * 256) | 0;
    }

    // 礦區
    const mid = { x: MAP_W / 2, y: MAP_H / 2 };
    const fields = [];
    for (const s of sc) {
      const vx = mid.x - s.x, vy = mid.y - s.y, l = Math.hypot(vx, vy);
      const ux = vx / l, uy = vy / l, px = -uy, py = ux;
      fields.push({ x: s.x + ux * 8 + px * 4, y: s.y + uy * 8 + py * 4, r: 3.6, gem: 0 });
      fields.push({ x: s.x + ux * 3 - px * 8, y: s.y + uy * 3 - py * 8, r: 3.0, gem: 0 });
    }
    fields.push({ x: mid.x, y: mid.y, r: 3.2, gem: 1 });
    fields.push({ x: 18, y: 18, r: 4, gem: 0 });
    fields.push({ x: MAP_W - 18, y: MAP_H - 18, r: 4, gem: 0 });
    for (const f of fields) {
      f.x = clamp(f.x, 4, MAP_W - 5); f.y = clamp(f.y, 4, MAP_H - 5);
      const R = Math.ceil(f.r + 1);
      for (let y = Math.floor(f.y) - R; y <= f.y + R; y++) for (let x = Math.floor(f.x) - R; x <= f.x + R; x++) {
        if (!this.inb(x, y)) continue;
        const d = Math.hypot(x + 0.5 - f.x, y + 0.5 - f.y);
        if (d > f.r * (0.75 + 0.35 * rng())) continue;
        const i = this.idx(x, y);
        if (this.terrain[i] !== T_GRASS && this.terrain[i] !== T_SAND) this.terrain[i] = T_DIRT;
        this.oreType[i] = f.gem && rng() < 0.6 ? 2 : 1;
        this.oreMax[i] = 300 + (1 - d / f.r) * 500;
        this.ore[i] = this.oreMax[i];
      }
      this.oreFields.push(f);
    }

    // 確保連通
    const ensure = (ax, ay, bx, by) => {
      if (this.reachable(ax | 0, ay | 0, bx | 0, by | 0)) return;
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps);
        for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
          if (!this.inb(x + ox, y + oy)) continue;
          const i = this.idx(x + ox, y + oy);
          if (!this.terrainOk(x + ox, y + oy)) this.terrain[i] = T_DIRT;
        }
      }
    };
    ensure(sc[0].x, sc[0].y, sc[1].x, sc[1].y);
    for (const f of fields) { ensure(sc[0].x, sc[0].y, f.x, f.y); ensure(sc[1].x, sc[1].y, f.x, f.y); }
  }

  reachable(ax, ay, bx, by) {
    const seen = new Uint8Array(MAP_W * MAP_H);
    const q = [ax + ay * MAP_W]; seen[q[0]] = 1;
    while (q.length) {
      const c = q.pop(), x = c % MAP_W, y = (c / MAP_W) | 0;
      if (Math.abs(x - bx) <= 1 && Math.abs(y - by) <= 1) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.terrainOk(nx, ny)) continue;
        const ni = nx + ny * MAP_W;
        if (!seen[ni]) { seen[ni] = 1; q.push(ni); }
      }
    }
    return false;
  }

  nearestPassable(x, y, maxR = 12, avoid) {
    x = clamp(Math.floor(x), 0, MAP_W - 1); y = clamp(Math.floor(y), 0, MAP_H - 1);
    if (this.passable(x, y) && !(avoid && avoid(x, y))) return [x, y];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (!this.passable(nx, ny) || (avoid && avoid(nx, ny))) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      if (best) return best;
    }
    return null;
  }

  // A* 尋路;回傳磚格陣列 [[x,y],...](不含起點)
  findPath(sx, sy, gx, gy, maxNodes = 6000) {
    sx = Math.floor(sx); sy = Math.floor(sy); gx = Math.floor(gx); gy = Math.floor(gy);
    if (!this.passable(gx, gy)) {
      const p = this.nearestPassable(gx, gy, 8);
      if (!p) return [];
      gx = p[0]; gy = p[1];
    }
    if (sx === gx && sy === gy) return [];
    const N = MAP_W * MAP_H;
    const g = new Float32Array(N).fill(1e9);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = []; // [f, idx]
    const push = (f, i) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1; let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
        }
      }
      return top;
    };
    const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const si = this.idx(sx, sy), gi = this.idx(gx, gy);
    g[si] = 0; push(h(sx, sy), si);
    let best = si, bestH = h(sx, sy), count = 0;
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length && count++ < maxNodes) {
      const [, c] = pop();
      if (closed[c]) continue;
      closed[c] = 1;
      if (c === gi) { best = c; break; }
      const cx = c % MAP_W, cy = (c / MAP_W) | 0;
      const hc = h(cx, cy);
      if (hc < bestH) { bestH = hc; best = c; }
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.passable(nx, ny)) continue;
        if (dx && dy && (!this.passable(cx + dx, cy) || !this.passable(cx, cy + dy))) continue;
        const ni = nx + ny * MAP_W;
        if (closed[ni]) continue;
        const ng = g[c] + cost;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = c; push(ng + h(nx, ny), ni); }
      }
    }
    const path = [];
    let c = best;
    while (c !== si && c !== -1) { path.push([c % MAP_W, (c / MAP_W) | 0]); c = from[c]; }
    path.reverse();
    return this.smooth(sx, sy, path);
  }

  // 視線檢查,用於平滑路徑
  lineClear(x0, y0, x1, y1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
    for (let k = 1; k < steps; k++) {
      const x = x0 + (x1 - x0) * k / steps, y = y0 + (y1 - y0) * k / steps;
      for (const [ox, oy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]])
        if (!this.passable(Math.floor(x + ox), Math.floor(y + oy))) return false;
    }
    return true;
  }
  smooth(sx, sy, path) {
    if (path.length < 3) return path;
    const out = [];
    let cx = sx, cy = sy, i = 0;
    while (i < path.length) {
      let j = Math.min(path.length - 1, i + 8);
      while (j > i && !this.lineClear(cx + 0.5, cy + 0.5, path[j][0] + 0.5, path[j][1] + 0.5)) j--;
      out.push(path[j]); cx = path[j][0]; cy = path[j][1]; i = j + 1;
    }
    return out;
  }
}
